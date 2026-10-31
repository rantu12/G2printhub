
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  try {
    const { slug } = await params;

    const product = await prisma.customPrintProduct.findFirst({
      where: {
        slug,
        active: true,
        availability: true,
        category: { active: true },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
        description: true,
        image: true,
        images: true,
        colors: true,
        sizes: true,
        options: true,
        printAreas: true,
        customizationSettings: true,
        price: true,
        salePrice: true,
        stock: true,
        modelId: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const settings = product.customizationSettings;
    const model = product.modelId
      ? await prisma.customPrintModel.findUnique({
          where: { id: product.modelId },
          select: { modelUrl: true, printAreas: true },
        })
      : null;

    const savedModelUrl =
      settings !== null &&
      typeof settings === "object" &&
      !Array.isArray(settings) &&
      "modelUrl" in settings &&
      typeof settings.modelUrl === "string"
        ? settings.modelUrl
        : null;

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        printAreas: model?.printAreas ?? product.printAreas ?? [],
        modelUrl: model?.modelUrl ?? savedModelUrl,
      },
    });
  } catch (error) {
    console.error("Public Custom Print product error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load this product." },
      { status: 500 }
    );
  }
}
