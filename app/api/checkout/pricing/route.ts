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
    const requestedCustomPrintIds = params.getAll("customPrintProductId");
    const customPrintProductIds = [
      ...new Set(requestedCustomPrintIds.map((id) => id.trim())),
    ];

    if (
      productIds.length + customPrintProductIds.length > 100 ||
      [...productIds, ...customPrintProductIds].some(
        (id) => !id || id.length > 100
      )
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
    const customPrintProducts =
        customPrintProductIds.length > 0
          ? await prisma.customPrintProduct.findMany({
              where: {
                id: { in: customPrintProductIds },
                active: true,
                availability: true,
                category: { active: true },
              },
              select: { id: true },
            })
          : [];
    const codEnabled = isCodAvailableForProducts(
        settings.codEnabled,
        [
          ...products.map(
            (product) =>
              product.codEnabled &&
              product.status === "ACTIVE" &&
              product.availability
          ),
          ...customPrintProducts.map(() => true),
        ],
        productIds.length + customPrintProductIds.length
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
