import { NextResponse } from "next/server";
import { calculateCouponDiscountCents, getCouponUnavailableReason } from "@/lib/coupons";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/store-settings";
import { calculateOrderCharges } from "@/lib/order-pricing";

type ValidationItem = { productId: string; quantity: number };

function isValidationItem(value: unknown): value is ValidationItem {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "string" &&
    Boolean(item.productId.trim()) &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity >= 1 &&
    item.quantity <= 99
  );
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "A valid coupon and cart are required." },
        { status: 400 }
      );
    }
    const payload = body as Record<string, unknown>;
    const code =
      typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      return NextResponse.json(
        { success: false, message: "Enter a valid coupon code." },
        { status: 400 }
      );
    }
    if (
      !Array.isArray(payload.items) ||
      payload.items.length === 0 ||
      payload.items.length > 100
    ) {
      return NextResponse.json(
        { success: false, message: "Your cart is empty or invalid." },
        { status: 400 }
      );
    }

    const quantities = new Map<string, number>();
    for (const value of payload.items) {
      if (!isValidationItem(value)) {
        return NextResponse.json(
          { success: false, message: "Invalid product or quantity." },
          { status: 400 }
        );
      }
      quantities.set(
        value.productId.trim(),
        (quantities.get(value.productId.trim()) ?? 0) + value.quantity
      );
    }
    if ([...quantities.values()].some((quantity) => quantity > 99)) {
      return NextResponse.json(
        { success: false, message: "Maximum quantity per product is 99." },
        { status: 400 }
      );
    }

    const products = await prisma.product.findMany({
      where: {
        id: { in: [...quantities.keys()] },
        status: "ACTIVE",
        availability: true,
      },
      select: { id: true, price: true, discountPrice: true },
    });
    if (products.length !== quantities.size) {
      return NextResponse.json(
        { success: false, message: "One or more products are unavailable." },
        { status: 409 }
      );
    }
    const subtotalCents = products.reduce((total, product) => {
      const unitPriceCents = Math.round(
        Number(product.discountPrice ?? product.price) * 100
      );
      return total + unitPriceCents * (quantities.get(product.id) ?? 0);
    }, 0);
    if (!Number.isSafeInteger(subtotalCents)) {
      return NextResponse.json(
        { success: false, message: "A product price or order total is invalid." },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) {
      return NextResponse.json(
        { success: false, message: "That coupon code was not found." },
        { status: 404 }
      );
    }
    const unavailableReason = getCouponUnavailableReason(coupon);
    if (unavailableReason) {
      return NextResponse.json(
        { success: false, message: unavailableReason },
        { status: 400 }
      );
    }

    let discountCents: number;
    try {
      discountCents = calculateCouponDiscountCents(coupon, subtotalCents);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error instanceof Error ? error.message : "Unable to apply this coupon.",
        },
        { status: 400 }
      );
    }

    const settings = await getStoreSettings();
    const { shippingFeeCents, taxCents, totalCents } =
      calculateOrderCharges(
        subtotalCents,
        discountCents,
        settings.shippingFee.toString(),
        settings.taxRate.toString()
      );

    return NextResponse.json({
      success: true,
      message: "Coupon applied successfully.",
      coupon: {
        code: coupon.code,
        discount: (discountCents / 100).toFixed(2),
        subtotal: (subtotalCents / 100).toFixed(2),
        shippingFee: (shippingFeeCents / 100).toFixed(2),
        tax: (taxCents / 100).toFixed(2),
        total: (totalCents / 100).toFixed(2),
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }
    console.error("Coupon validation error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to validate coupon." },
      { status: 500 }
    );
  }
}
