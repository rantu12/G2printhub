import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createNeonModelPreviewUrl,
  isNeonModelObjectKey,
} from "@/lib/neon-object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
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
        modelId: true,
        customizationSettings: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const model = product.modelId
      ? await prisma.customPrintModel.findUnique({
          where: { id: product.modelId },
          select: { modelUrl: true },
        })
      : null;
    const settings = product.customizationSettings;
    const savedModelUrl =
      settings !== null &&
      typeof settings === "object" &&
      !Array.isArray(settings) &&
      "modelUrl" in settings &&
      typeof settings.modelUrl === "string"
        ? settings.modelUrl
        : null;
    const modelUrl = model?.modelUrl ?? savedModelUrl;

    if (!modelUrl) {
      return NextResponse.json(
        { success: false, message: "No 3D model is configured for this product." },
        { status: 404 }
      );
    }

    if (!isNeonModelObjectKey(modelUrl)) {
      return NextResponse.json({ success: true, modelUrl });
    }

    const previewUrl = await createNeonModelPreviewUrl(modelUrl);
    return NextResponse.json(
      { success: true, modelUrl: previewUrl },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NEON_OBJECT_STORAGE_ENV_MISSING") {
      return NextResponse.json(
        { success: false, message: "Neon Object Storage is not configured for this environment." },
        { status: 503 }
      );
    }

    console.error(
      "Custom Print model preview URL could not be created:",
      error instanceof Error ? error.message : "Unknown storage error"
    );
    return NextResponse.json(
      { success: false, message: "Unable to load the 3D model preview." },
      { status: 500 }
    );
  }
}
