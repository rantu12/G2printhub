
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  createNeonModelPreviewUrl,
  isNeonModelObjectKey,
  verifyNeonModelObject,
} from "@/lib/neon-object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in first." },
      { status: 401 }
    );
  }

  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "Admin access required." },
      { status: 403 }
    );
  }
  if (message === "NEON_OBJECT_STORAGE_ENV_MISSING") {
    return NextResponse.json(
      { success: false, message: "Neon Object Storage is not configured for this environment." },
      { status: 503 }
    );
  }

  console.error("Custom Print product API error:", error);

  return NextResponse.json(
    { success: false, message: "Unable to process products." },
    { status: 500 }
  );
}

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isStringArray(value: unknown, maxItems: number, maxLength: number) {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every(
      (item: unknown) =>
        typeof item === "string" && item.length <= maxLength
    )
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

// GET: List products
export async function GET() {
  try {
    await requireAdmin();

    const products = await prisma.customPrintProduct.findMany({
      include: { category: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    const productsWithPreviewUrls = await Promise.all(
      products.map(async (product) => {
        const settings = isObject(product.customizationSettings)
          ? product.customizationSettings
          : null;
        const modelUrl = settings?.modelUrl;
        if (typeof modelUrl !== "string" || !isNeonModelObjectKey(modelUrl)) {
          return product;
        }
        return {
          ...product,
          modelPreviewUrl: await createNeonModelPreviewUrl(modelUrl),
        };
      })
    );

    return NextResponse.json({ success: true, products: productsWithPreviewUrls });
  } catch (error) {
    return handleError(error);
  }
}

// POST: Create product
export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";
    const slug =
      typeof body.slug === "string"
        ? body.slug.trim().toLowerCase()
        : "";
    const sku =
      typeof body.sku === "string"
        ? body.sku.trim().toUpperCase()
        : "";
    const categoryId =
      typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    const modelId =
      typeof body.modelId === "string" ? body.modelId.trim() : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null;
    const image =
      typeof body.image === "string"
        ? body.image.trim() || null
        : null;

    const price = Number(body.price);
    const salePrice =
      body.salePrice === "" || body.salePrice == null
        ? null
        : Number(body.salePrice);
    const stock = Number(body.stock ?? 0);

    const images = body.images ?? [];
    const colors = body.colors ?? [];
    const sizes = body.sizes ?? [];

    if (!name || !slug || !sku || !categoryId) {
      return NextResponse.json(
        {
          success: false,
          message: "Name, slug, SKU and category are required.",
        },
        { status: 400 }
      );
    }

    if (!slugPattern.test(slug)) {
      return NextResponse.json(
        { success: false, message: "Invalid product slug." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      (salePrice !== null &&
        (!Number.isFinite(salePrice) ||
          salePrice < 0 ||
          salePrice > price)) ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid price or stock." },
        { status: 400 }
      );
    }

    if (
      !isStringArray(images, 10, 500) ||
      !isStringArray(colors, 20, 100) ||
      !isStringArray(sizes, 20, 100)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid images, colors or sizes." },
        { status: 400 }
      );
    }

    const category = await prisma.customPrintCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Custom Print category not found." },
        { status: 404 }
      );
    }

    const model = modelId
      ? await prisma.customPrintModel.findFirst({
          where: { id: modelId, active: true },
          select: { id: true, modelUrl: true, printAreas: true },
        })
      : null;
    if (modelId && !model) {
      return NextResponse.json(
        { success: false, message: "Select an active 3D model." },
        { status: 400 }
      );
    }

    const existing = await prisma.customPrintProduct.findFirst({
      where: { OR: [{ slug }, { sku }] },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Product slug or SKU already exists.",
        },
        { status: 409 }
      );
    }

    const settings = {
      ...(isObject(body.customizationSettings)
        ? body.customizationSettings
        : {}),
      ...(model ? { modelUrl: model.modelUrl, allowArtwork: true } : {}),
    };

    const product = await prisma.customPrintProduct.create({
      data: {
        name,
        slug,
        sku,
        description,
        image,
        
        images: [...new Set(images as string[])],
        colors: [...new Set(colors as string[])],
        sizes: [...new Set(sizes as string[])],

        price,
        salePrice,
        stock,
        availability: body.availability !== false,
        active: body.active !== false,
        ...(model ? { model: { connect: { id: model.id } }, printAreas: model.printAreas ?? [] } : {}),
        customizationSettings: settings,
        category: { connect: { id: categoryId } },
      },
      include: { category: true },
    });

    return NextResponse.json(
      { success: true, product },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}

// PUT: Update product
export async function PUT(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Product ID is required." },
        { status: 400 }
      );
    }

    const current = await prisma.customPrintProduct.findUnique({
      where: { id },
    });

    if (!current) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json(
          { success: false, message: "Invalid product name." },
          { status: 400 }
        );
      }
      data.name = body.name.trim();
    }

    if (body.slug !== undefined) {
      if (
        typeof body.slug !== "string" ||
        !slugPattern.test(body.slug.trim().toLowerCase())
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid product slug." },
          { status: 400 }
        );
      }
      data.slug = body.slug.trim().toLowerCase();
    }

    if (body.sku !== undefined) {
      if (typeof body.sku !== "string" || !body.sku.trim()) {
        return NextResponse.json(
          { success: false, message: "Invalid product SKU." },
          { status: 400 }
        );
      }
      data.sku = body.sku.trim().toUpperCase();
    }

    if (body.description !== undefined) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid description." },
          { status: 400 }
        );
      }
      data.description =
        typeof body.description === "string"
          ? body.description.trim() || null
          : null;
    }

    if (body.image !== undefined) {
      if (body.image !== null && typeof body.image !== "string") {
        return NextResponse.json(
          { success: false, message: "Invalid image." },
          { status: 400 }
        );
      }
      data.image =
        typeof body.image === "string"
          ? body.image.trim() || null
          : null;
    }

    const nextPrice =
      body.price !== undefined ? Number(body.price) : Number(current.price);

    if (body.price !== undefined) {
      if (!Number.isFinite(nextPrice) || nextPrice < 0) {
        return NextResponse.json(
          { success: false, message: "Invalid price." },
          { status: 400 }
        );
      }
      data.price = nextPrice;
    }

    if (body.salePrice !== undefined) {
      const nextSalePrice =
        body.salePrice === "" || body.salePrice === null
          ? null
          : Number(body.salePrice);

      if (
        nextSalePrice !== null &&
        (!Number.isFinite(nextSalePrice) ||
          nextSalePrice < 0 ||
          nextSalePrice > nextPrice)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid sale price." },
          { status: 400 }
        );
      }

      data.salePrice = nextSalePrice;
    }

    if (body.stock !== undefined) {
      const stock = Number(body.stock);
      if (!Number.isInteger(stock) || stock < 0) {
        return NextResponse.json(
          { success: false, message: "Invalid stock." },
          { status: 400 }
        );
      }
      data.stock = stock;
    }

    for (const field of ["active", "availability"] as const) {
      if (body[field] !== undefined) {
        if (typeof body[field] !== "boolean") {
          return NextResponse.json(
            { success: false, message: `Invalid ${field} value.` },
            { status: 400 }
          );
        }
        data[field] = body[field];
      }
    }

    for (const field of ["images", "colors", "sizes"] as const) {
      if (body[field] !== undefined) {
        const maxItems = field === "images" ? 10 : 20;
        const maxLength = field === "images" ? 500 : 100;

        if (!isStringArray(body[field], maxItems, maxLength)) {
          return NextResponse.json(
            { success: false, message: `Invalid ${field}.` },
            { status: 400 }
          );
        }

        data[field] = [...new Set(body[field])];
      }
    }

    if (body.categoryId !== undefined) {
      if (
        typeof body.categoryId !== "string" ||
        !body.categoryId.trim()
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid category." },
          { status: 400 }
        );
      }

      const category = await prisma.customPrintCategory.findUnique({
        where: { id: body.categoryId.trim() },
        select: { id: true },
      });

      if (!category) {
        return NextResponse.json(
          { success: false, message: "Custom Print category not found." },
          { status: 404 }
        );
      }

      data.category = { connect: { id: body.categoryId.trim() } };
    }

    if (body.modelId !== undefined) {
      if (body.modelId !== null && (typeof body.modelId !== "string" || !body.modelId.trim())) {
        return NextResponse.json(
          { success: false, message: "Invalid 3D model." },
          { status: 400 }
        );
      }
      const model = typeof body.modelId === "string"
        ? await prisma.customPrintModel.findFirst({
            where: { id: body.modelId.trim(), active: true },
            select: { id: true, modelUrl: true, printAreas: true },
          })
        : null;
      if (typeof body.modelId === "string" && !model) {
        return NextResponse.json(
          { success: false, message: "Select an active 3D model." },
          { status: 400 }
        );
      }
      if (model) {
        data.model = { connect: { id: model.id } };
        data.printAreas = model.printAreas ?? [];
        const existingSettings = isObject(current.customizationSettings)
          ? current.customizationSettings
          : {};
        data.customizationSettings = {
          ...existingSettings,
          modelUrl: model.modelUrl,
          allowArtwork: true,
        };
      } else {
        data.model = { disconnect: true };
      }
    }

    if (body.customizationSettings !== undefined) {
      if (
        body.customizationSettings !== null &&
        !isObject(body.customizationSettings)
      ) {
        return NextResponse.json(
          { success: false, message: "Invalid customization settings." },
          { status: 400 }
        );
      }
      if (
        isObject(body.customizationSettings) &&
        typeof body.customizationSettings.modelUrl === "string" &&
        isNeonModelObjectKey(body.customizationSettings.modelUrl)
      ) {
        try {
          await verifyNeonModelObject(body.customizationSettings.modelUrl);
        } catch (error) {
          if (error instanceof Error && error.message === "INVALID_NEON_MODEL_FILE") {
            return NextResponse.json(
              { success: false, message: "The uploaded file is not a valid GLB model." },
              { status: 400 }
            );
          }
          throw error;
        }
      }
      data.customizationSettings = body.customizationSettings;
    }

    if (body.printAreas !== undefined) {
      data.printAreas = body.printAreas;
    }

    const nextSlug =
      typeof data.slug === "string" ? data.slug : current.slug;
    const nextSku =
      typeof data.sku === "string" ? data.sku : current.sku;

    const duplicate = await prisma.customPrintProduct.findFirst({
      where: {
        id: { not: id },
        OR: [{ slug: nextSlug }, { sku: nextSku }],
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message: "Product slug or SKU already exists.",
        },
        { status: 409 }
      );
    }

    const product = await prisma.customPrintProduct.update({
      where: { id },
      data: data as Prisma.CustomPrintProductUpdateInput,
      include: { category: true },
    });

    return NextResponse.json({ success: true, product });
  } catch (error) {
    return handleError(error);
  }
}

// DELETE: Deactivate product instead of hard-deleting it
export async function DELETE(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Product ID is required." },
        { status: 400 }
      );
    }

    const product = await prisma.customPrintProduct.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "Product not found." },
        { status: 404 }
      );
    }

    await prisma.customPrintProduct.delete({
  where: { id },
});

   return NextResponse.json({
  success: true,
  message: "Product deleted successfully.",
});
  } catch (error) {
    return handleError(error);
  }
}
