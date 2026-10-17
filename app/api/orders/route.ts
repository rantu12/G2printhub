
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  calculateCouponDiscountCents,
  getCouponUnavailableReason,
} from "@/lib/coupons";
import { calculateOrderCharges } from "@/lib/order-pricing";
import { ensureStoreSettings } from "@/lib/store-settings";
import { isProductSize } from "@/lib/product-variants";
import {
  isCodAvailableForAmount,
  isCodAvailableForProducts,
} from "@/lib/cod-availability";
import { sendNewOrderNotificationEmail } from "@/lib/order-notification-email";
import { formatOrderNumber } from "@/lib/order-number";
import {
  assertCashfreeConfigured,
  cashfreeReturnUrl,
  createCashfreeOrder,
} from "@/lib/cashfree";

export const runtime = "nodejs";

type CheckoutItem = {
  productId: string;
  quantity: number;
  artworkId?: string;
  selectedColor?: string;
  selectedSize?: string;
};

type CheckoutBody = {
  items: CheckoutItem[];
  paymentMethod?: string;
  couponCode?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingAddress2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  customerNote?: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

async function cancelCashfreeOrderAndReleaseStock(orderId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        couponId: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
          },
        },
      },
    });
    if (
      !order ||
      order.status !== "PENDING" ||
      order.paymentStatus !== "UNPAID" ||
      order.paymentMethod !== "CASHFREE"
    ) {
      return;
    }

    const cancelled = await tx.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
        paymentStatus: "UNPAID",
        paymentMethod: "CASHFREE",
      },
      data: { status: "CANCELLED" },
    });
    if (cancelled.count !== 1) return;

    for (const item of order.items) {
      if (item.productId) {
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
    if (order.couponId) {
      await tx.coupon.updateMany({
        where: { id: order.couponId, usageCount: { gt: 0 } },
        data: { usageCount: { decrement: 1 } },
      });
    }
    await tx.customerArtwork.updateMany({
      where: { orderItemId: { in: order.items.map((item) => item.id) } },
      data: { orderItemId: null },
    });
  });
}

export async function POST(request: Request) {
  try {
    // Only authenticated customers can place orders.
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Please log in to place an order." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as Partial<CheckoutBody>;
    const paymentMethod = body.paymentMethod ?? "COD";
    if (paymentMethod !== "COD" && paymentMethod !== "CASHFREE") {
      return NextResponse.json(
        { success: false, message: "Choose a valid payment method." },
        { status: 400 }
      );
    }
    const initialStoreSettings = await ensureStoreSettings(prisma);
    if (initialStoreSettings.maintenanceMode) {
      return NextResponse.json(
        { success: false, message: "The store is temporarily unavailable for maintenance." },
        { status: 503 }
      );
    }
    const customerName = text(body.customerName) || user.name;
    const customerEmail = (
      text(body.customerEmail) || user.email
    ).toLowerCase();
    const customerPhone = text(body.customerPhone);
    const shippingAddress = text(body.shippingAddress);
    const shippingAddress2 = text(body.shippingAddress2);
    const city = text(body.city);
    const state = text(body.state);
    const postalCode = text(body.postalCode);
    const country = text(body.country);
    const customerNote = text(body.customerNote);
    const couponCode = text(body.couponCode).toUpperCase();

    if (couponCode && !/^[A-Z0-9_-]{3,32}$/.test(couponCode)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid coupon code." },
        { status: 400 }
      );
    }

    if (
      !customerName ||
      !customerEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) ||
      !customerPhone ||
      !shippingAddress ||
      !city ||
      !postalCode ||
      !country
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Please provide a valid name, email, phone and complete shipping address.",
        },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0 ||
      body.items.length > 100
    ) {
      return NextResponse.json(
        { success: false, message: "Your cart is empty or invalid." },
        { status: 400 }
      );
    }
    if (paymentMethod === "CASHFREE") {
      const storeSettings = await ensureStoreSettings(prisma);
      if (!storeSettings.cashfreeEnabled) {
        throw new Error("CASHFREE_DISABLED");
      }
      await assertCashfreeConfigured();
    }

    // Merge identical variants while keeping stock totals grouped by product.
    const quantities = new Map<string, number>();
    const variantQuantities = new Map<
      string,
      {
        productId: string;
        selectedColor: string | null;
        selectedSize: string | null;
        quantity: number;
      }
    >();
    const artworkIds = new Map<string, string>();

    for (const item of body.items) {
      if (
        !item ||
        typeof item.productId !== "string" ||
        !item.productId.trim() ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 99
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid product or quantity." },
          { status: 400 }
        );
      }

      const id = item.productId.trim();
      if (
        (item.selectedColor !== undefined &&
          (typeof item.selectedColor !== "string" ||
            !item.selectedColor.trim())) ||
        (item.selectedSize !== undefined &&
          (typeof item.selectedSize !== "string" ||
            !item.selectedSize.trim()))
      ) {
        return NextResponse.json(
          { success: false, message: "The selected product variant is invalid." },
          { status: 400 }
        );
      }
      if (
        item.artworkId !== undefined &&
        (typeof item.artworkId !== "string" || !item.artworkId.trim())
      ) {
        return NextResponse.json(
          { success: false, message: "The uploaded artwork is invalid." },
          { status: 400 }
        );
      }

      const artworkId = item.artworkId?.trim();
      const existingArtworkId = artworkIds.get(id);
      if (
        (existingArtworkId && artworkId && existingArtworkId !== artworkId) ||
        (existingArtworkId && !artworkId) ||
        (!existingArtworkId && artworkId && quantities.has(id))
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "A product can only have one artwork file per order.",
          },
          { status: 400 }
        );
      }
      if (artworkId) artworkIds.set(id, artworkId);

      const selectedColor = item.selectedColor?.trim() ?? null;
      const selectedSize = item.selectedSize?.trim() ?? null;
      const variantKey = JSON.stringify([id, selectedColor, selectedSize]);
      const variant = variantQuantities.get(variantKey);
      const nextVariantQuantity = (variant?.quantity ?? 0) + item.quantity;
      const nextProductQuantity = (quantities.get(id) ?? 0) + item.quantity;

      if (nextVariantQuantity > 99 || nextProductQuantity > 99) {
        return NextResponse.json(
          { success: false, message: "Maximum quantity per product is 99." },
          { status: 400 }
        );
      }

      quantities.set(id, nextProductQuantity);
      variantQuantities.set(variantKey, {
        productId: id,
        selectedColor,
        selectedSize,
        quantity: nextVariantQuantity,
      });
    }

    const productIds = [...quantities.keys()];

    const order = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          status: "ACTIVE",
          availability: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("PRODUCT_UNAVAILABLE");
      }
      if (
        paymentMethod === "COD" &&
        !isCodAvailableForProducts(
          true,
          products.map((product) => product.codEnabled)
        )
      ) {
        throw new Error("PRODUCT_COD_DISABLED");
      }

      const productMap = new Map(
        products.map((product) => [product.id, product])
      );
      const enabledProductIds = products
        .filter((product) => product.customerArtworkEnabled)
        .map((product) => product.id);
      const uploadedArtworks = await tx.customerArtwork.findMany({
        where: {
          productId: { in: enabledProductIds },
          userId: user.id,
          orderItemId: null,
        },
        select: { id: true, productId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      });
      const artworkMap = new Map(
        uploadedArtworks.map((artwork) => [artwork.id, artwork])
      );
      const latestArtworkByProduct = new Map<string, string>();
      for (const artwork of uploadedArtworks) {
        if (!latestArtworkByProduct.has(artwork.productId)) {
          latestArtworkByProduct.set(artwork.productId, artwork.id);
        }
      }

      const orderItems: {
        productId: string;
        productName: string;
        productSlug: string;
        productImage: string | null;
        sku: string;
        quantity: number;
        unitPrice: string;
        lineTotal: string;
        artworkId: string | null;
        selectedColor: string | null;
        selectedSize: string | null;
      }[] = [];

      let subtotalCents = 0;
      const artworkAssignedToProduct = new Set<string>();

      for (const {
        productId,
        selectedColor,
        selectedSize,
        quantity,
      } of variantQuantities.values()) {
        const product = productMap.get(productId);

        if (!product) {
          throw new Error("PRODUCT_UNAVAILABLE");
        }
        if (
          (product.colors.length > 0 &&
            (!selectedColor || !product.colors.includes(selectedColor))) ||
          (product.colors.length === 0 && selectedColor) ||
          (product.sizes.length > 0 &&
            (!isProductSize(selectedSize) ||
              !product.sizes.includes(selectedSize))) ||
          (product.sizes.length === 0 && selectedSize)
        ) {
          throw new Error("INVALID_PRODUCT_VARIANT");
        }
        if (product.stock < (quantities.get(productId) ?? 0)) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        const requestedArtworkId = product.customerArtworkEnabled
          ? artworkIds.get(productId) ??
            latestArtworkByProduct.get(productId) ??
            null
          : null;
        if (requestedArtworkId) {
          const artwork = artworkMap.get(requestedArtworkId);
          if (!artwork || artwork.productId !== product.id) {
            throw new Error("INVALID_ARTWORK");
          }
        }
        const artworkId =
          requestedArtworkId && !artworkAssignedToProduct.has(productId)
            ? requestedArtworkId
            : null;
        if (artworkId) artworkAssignedToProduct.add(productId);

        // Use the database price, never a price sent by the browser.
        const databasePrice =
          product.discountPrice ?? product.price;
        const unitPriceCents = Math.round(
          Number(databasePrice) * 100
        );

        if (
          !Number.isSafeInteger(unitPriceCents) ||
          unitPriceCents < 0
        ) {
          throw new Error("INVALID_PRODUCT_PRICE");
        }

        const lineTotalCents = unitPriceCents * quantity;
        subtotalCents += lineTotalCents;

        orderItems.push({
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          productImage: product.image,
          sku: product.sku,
          quantity,
          unitPrice: money(unitPriceCents),
          lineTotal: money(lineTotalCents),
          artworkId,
          selectedColor,
          selectedSize,
        });
      }

      if (!Number.isSafeInteger(subtotalCents)) {
        throw new Error("INVALID_ORDER_TOTAL");
      }

      let couponId: string | null = null;
      let appliedCouponCode: string | null = null;
      let discountCents = 0;
      if (couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: couponCode },
        });
        if (!coupon) {
          throw new Error("COUPON_NOT_FOUND");
        }
        const unavailableReason = getCouponUnavailableReason(coupon);
        if (unavailableReason) {
          throw new Error(`COUPON_UNAVAILABLE:${unavailableReason}`);
        }
        discountCents = calculateCouponDiscountCents(
          coupon,
          subtotalCents
        );
        const now = new Date();
        const claim = await tx.coupon.updateMany({
          where: {
            id: coupon.id,
            code: coupon.code,
            isActive: true,
            discountType: coupon.discountType,
            value: coupon.value,
            minimumSubtotal: coupon.minimumSubtotal,
            maximumDiscount: coupon.maximumDiscount,
            usageLimit: coupon.usageLimit,
            startsAt: coupon.startsAt,
            endsAt: coupon.endsAt,
            ...(coupon.usageLimit === null
              ? {}
              : { usageCount: { lt: coupon.usageLimit } }),
            AND: [
              {
                OR: [
                  { startsAt: null },
                  { startsAt: { lte: now } },
                ],
              },
              {
                OR: [
                  { endsAt: null },
                  { endsAt: { gte: now } },
                ],
              },
            ],
          },
          data: { usageCount: { increment: 1 } },
        });
        if (claim.count !== 1) {
          throw new Error("COUPON_UNAVAILABLE:This coupon is no longer available.");
        }
        couponId = coupon.id;
        appliedCouponCode = coupon.code;
      }

      const storeSettings = await ensureStoreSettings(tx);
      if (paymentMethod === "COD" && !storeSettings.codEnabled) {
        throw new Error("COD_DISABLED");
      }
      if (
        storeSettings.defaultOrderStatus !== "PENDING" &&
        storeSettings.defaultOrderStatus !== "ACCEPTED"
      ) {
        throw new Error("STORE_DEFAULT_ORDER_STATUS_INVALID");
      }
      if (paymentMethod === "CASHFREE" && !storeSettings.cashfreeEnabled) {
        throw new Error("CASHFREE_DISABLED");
      }
      const { shippingFeeCents, taxCents, totalCents } =
        calculateOrderCharges(
          subtotalCents,
          discountCents,
          storeSettings.shippingFee.toString(),
          storeSettings.taxRate.toString(),
          paymentMethod === "COD" ? storeSettings.codFee.toString() : "0"
        );
      const codFeeCents =
        paymentMethod === "COD"
          ? Math.round(Number(storeSettings.codFee) * 100)
          : 0;
      const codMinimumCents = Math.round(
        Number(storeSettings.codMinimumAmount) * 100
      );
      const codMaximumCents =
        storeSettings.codMaximumAmount === null
          ? null
          : Math.round(Number(storeSettings.codMaximumAmount) * 100);
      if (
        paymentMethod === "COD" &&
        !isCodAvailableForAmount(
          totalCents,
          codMinimumCents,
          codMaximumCents
        )
      ) {
        throw new Error("COD_AMOUNT_RESTRICTED");
      }

      // Reserve stock conditionally to prevent overselling.
      for (const item of orderItems) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            status: "ACTIVE",
            availability: true,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new Error("INSUFFICIENT_STOCK");
        }
      }

      const [{ value: orderNumberValue }] = await tx.$queryRaw<
        { value: string }[]
      >`SELECT nextval('"Order_orderNumber_seq"')::text AS value`;

      return tx.order.create({
        data: {
          orderNumber: formatOrderNumber(orderNumberValue),
          userId: user.id,
          customerName,
          customerEmail,
          customerPhone,
          shippingAddress,
          shippingAddress2: shippingAddress2 || null,
          city,
          state: state || null,
          postalCode,
          country,
          subtotal: money(subtotalCents),
          couponId,
          couponCode: appliedCouponCode,
          discount: money(discountCents),
          shippingFee: money(shippingFeeCents),
          codFee: money(codFeeCents),
          tax: money(taxCents),
          total: money(totalCents),
          status:
            paymentMethod === "CASHFREE"
              ? "PENDING"
              : storeSettings.defaultOrderStatus,
          paymentStatus: "UNPAID",
          paymentMethod,
          customerNote: customerNote || null,
          items: {
            create: orderItems.map(({ artworkId, ...item }) => ({
              ...item,
              ...(artworkId
                ? { artwork: { connect: { id: artworkId } } }
                : {}),
            })),
          },
          notification: { create: {} },
        },
        include: {
          items: true,
        },
      });
    });

    let paymentSessionId: string | undefined;
    if (paymentMethod === "CASHFREE") {
      try {
        paymentSessionId = await createCashfreeOrder({
          orderId: order.orderNumber,
          amount: order.total.toString(),
          customerId: user.id,
          customerName,
          customerEmail,
          customerPhone,
          returnUrl: await cashfreeReturnUrl(order.orderNumber),
        });
      } catch (cashfreeError) {
        try {
          await cancelCashfreeOrderAndReleaseStock(order.id);
        } catch (cleanupError) {
          console.error(
            `Unable to release inventory for failed Cashfree order ${order.orderNumber}:`,
            cleanupError
          );
        }
        throw cashfreeError;
      }
    }

    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", isBlocked: false },
        select: { email: true },
      });
      await sendNewOrderNotificationEmail(
        admins.map((admin) => admin.email),
        order,
      );
    } catch (notificationError) {
      console.error(
        `Order ${order.orderNumber} was created, but its admin email notification failed:`,
        notificationError,
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Order placed successfully.",
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          subtotal: order.subtotal.toString(),
          couponCode: order.couponCode,
          discount: order.discount.toString(),
          shippingFee: order.shippingFee.toString(),
          codFee: order.codFee.toString(),
          tax: order.tax.toString(),
          total: order.total.toString(),
          items: order.items,
          createdAt: order.createdAt,
          ...(paymentSessionId ? { paymentSessionId } : {}),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message === "STORE_DEFAULT_ORDER_STATUS_INVALID") {
        console.error("Invalid configured default order status.");
        return NextResponse.json(
          { success: false, message: "The store order status configuration is invalid." },
          { status: 500 }
        );
      }
      if (error.message === "INVALID_PRODUCT_VARIANT") {
        return NextResponse.json(
          {
            success: false,
            message: "A selected color or size is no longer available. Update your cart.",
          },
          { status: 400 }
        );
      }
      if (error.message === "COD_DISABLED") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Cash on Delivery is currently unavailable. Please choose online payment.",
          },
          { status: 409 }
        );
      }
      if (error.message === "COD_AMOUNT_RESTRICTED") {
        return NextResponse.json(
          {
            success: false,
            message:
              "This order total is outside the Cash on Delivery amount limits. Choose online payment or adjust your cart.",
          },
          { status: 409 }
        );
      }
      if (error.message === "PRODUCT_COD_DISABLED") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Cash on Delivery is unavailable for one or more products in your cart. Please choose online payment.",
          },
          { status: 409 }
        );
      }
      if (error.message === "CASHFREE_DISABLED") {
        return NextResponse.json(
          { success: false, message: "Cashfree Payments is currently unavailable." },
          { status: 409 }
        );
      }
      if (error.message === "CASHFREE_NOT_CONFIGURED") {
        return NextResponse.json(
          {
            success: false,
            message: "Cashfree Payments is not configured. Please contact support.",
          },
          { status: 503 }
        );
      }
      if (
        error.message === "CASHFREE_ENVIRONMENT_INVALID" ||
        error.message === "CASHFREE_CREDENTIALS_ENVIRONMENT_MISMATCH" ||
        error.message === "APP_URL_INVALID"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Cashfree Payments is misconfigured. Please contact support.",
          },
          { status: 503 }
        );
      }
      if (
        error.message === "CASHFREE_PHONE_INVALID" ||
        error.message.startsWith("CASHFREE_REQUEST_FAILED:") ||
        error.message === "CASHFREE_RESPONSE_INVALID"
      ) {
        console.error("Cashfree order creation error:", error);
        return NextResponse.json(
          {
            success: false,
            message:
              error.message === "CASHFREE_PHONE_INVALID"
                ? "Enter a valid 10-digit mobile number for online payment."
                : "Unable to start Cashfree checkout. Please try again.",
          },
          { status: error.message === "CASHFREE_PHONE_INVALID" ? 400 : 502 }
        );
      }

      if (error.message === "INVALID_ARTWORK") {
        return NextResponse.json(
          {
            success: false,
            message:
              "The attached file is invalid or no longer available. Upload it again and retry.",
          },
          { status: 400 }
        );
      }

      if (error.message === "PRODUCT_UNAVAILABLE") {
        return NextResponse.json(
          {
            success: false,
            message: "One or more products are unavailable.",
          },
          { status: 409 }
        );
      }

      if (error.message === "INSUFFICIENT_STOCK") {
        return NextResponse.json(
          {
            success: false,
            message:
              "Stock changed or is insufficient. Please update your cart.",
          },
          { status: 409 }
        );
      }

      if (error.message === "COUPON_NOT_FOUND") {
        return NextResponse.json(
          { success: false, message: "That coupon code was not found." },
          { status: 400 }
        );
      }
      if (error.message.startsWith("COUPON_UNAVAILABLE:")) {
        return NextResponse.json(
          {
            success: false,
            message: error.message.slice("COUPON_UNAVAILABLE:".length),
          },
          { status: 409 }
        );
      }
      if (
        error.message.startsWith("A minimum subtotal") ||
        error.message === "INVALID_ORDER_TOTAL"
      ) {
        return NextResponse.json(
          { success: false, message: error.message },
          { status: 400 }
        );
      }

      if (
        error.message === "INVALID_PRODUCT_PRICE" ||
        error.message === "INVALID_ORDER_TOTAL"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "A product price or order total is invalid.",
          },
          { status: 400 }
        );
      }
    }

    console.error("Create order error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to place the order. Please try again.",
      },
      { status: 500 }
    );
  }
}
