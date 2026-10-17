import { NextResponse } from "next/server";
import { getStoreSettings } from "@/lib/store-settings";
import { prisma } from "@/lib/prisma";
import { getCashfreeMode, isCashfreeConfigured } from "@/lib/cashfree";
import { isCodAvailableForProducts } from "@/lib/cod-availability";

export async function GET(request: Request) {
  try {
    const settings = await getStoreSettings();
    const params = new URL(request.url).searchParams;
    const requestedProductIds = params.getAll("productId");
    const productIds = [...new Set(requestedProductIds.map((id) => id.trim()))];

    if (
      productIds.length > 100 ||
      productIds.some((id) => !id || id.length > 100)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid cart products." },
        { status: 400 }
      );
    }

    const products =
      productIds.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: productIds } },
              select: {
                id: true,
                codEnabled: true,
                status: true,
                availability: true,
              },
          })
        : [];
    const codEnabled = isCodAvailableForProducts(
      settings.codEnabled,
      products.map(
        (product) =>
          product.codEnabled &&
          product.status === "ACTIVE" &&
          product.availability
      ),
      productIds.length
    );

    return NextResponse.json({
      success: true,
      settings: {
        shippingFee: settings.shippingFee.toString(),
        taxRate: settings.taxRate.toString(),
        codEnabled,
        codMinimumAmount: settings.codMinimumAmount.toString(),
        codMaximumAmount: settings.codMaximumAmount?.toString() ?? "",
        codFee: settings.codFee.toString(),
        cashfreeEnabled: settings.cashfreeEnabled,
        cashfreeConfigured: await isCashfreeConfigured(),
        cashfreeMode: await getCashfreeMode(),
      },
    });
  } catch (error) {
    console.error("Checkout pricing GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load checkout pricing." },
      { status: 500 }
    );
  }
}
