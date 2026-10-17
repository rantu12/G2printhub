import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isProductSize } from "@/lib/product-variants";
import { requireAdmin } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      {
        success: false,
        message: "Authentication required.",
      },
      { status: 401 }
    );
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      {
        success: false,
        message: "Admin access required.",
      },
      { status: 403 }
    );
  }

  return null;
}

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message: "Product not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Product GET error:", error);

    const auth = authError(error);
    if (auth) return auth;

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load product.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    const body = await request.json();

    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      return NextResponse.json(
        {
          success: false,
          message: "Product not found.",
        },
        { status: 404 }
      );
    }

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const title =
      typeof body.title === "string"
        ? body.title.trim()
        : "";

    const slug =
      typeof body.slug === "string"
        ? body.slug.trim().toLowerCase()
        : "";

    const sku =
      typeof body.sku === "string"
        ? body.sku.trim().toUpperCase()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    const image =
      typeof body.image === "string"
        ? body.image.trim()
        : null;

    const imageList: unknown[] = Array.isArray(body.images)
      ? body.images
      : existingProduct.images;
    const colorList: unknown[] = Array.isArray(body.colors)
      ? body.colors
      : existingProduct.colors;
    const sizeList: unknown[] = Array.isArray(body.sizes)
      ? body.sizes
      : existingProduct.sizes;
    const images = imageList.filter(
      (item): item is string => typeof item === "string" && item.length <= 500
    );
    const colors = colorList.filter(
      (item): item is string => typeof item === "string"
    );
    const sizes = sizeList.filter(
      (item): item is string => typeof item === "string"
    );
    const allowedColors = new Set([
      "Black",
      "White",
      "Red",
      "Blue",
      "Pink",
      "Green",
    ]);

    if (
      imageList.length > 5 ||
      images.length !== imageList.length ||
      colors.length > 6 ||
      colors.length !== colorList.length ||
      sizeList.length > 7 ||
      sizes.length !== sizeList.length ||
      sizes.some((item) => !isProductSize(item)) ||
      (body.sizes !== undefined && !Array.isArray(body.sizes)) ||
      colors.some((item) => !allowedColors.has(item))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product gallery, color, or size variants.",
        },
        { status: 400 }
      );
    }

    const categoryId =
      typeof body.categoryId === "string"
        ? body.categoryId
        : "";

    const price = Number(body.price);

    const discountPrice =
      body.discountPrice === null ||
      body.discountPrice === undefined ||
      body.discountPrice === ""
        ? null
        : Number(body.discountPrice);

    const stock = Number(body.stock);

    const availability =
      typeof body.availability === "boolean"
        ? body.availability
        : true;

    const codEnabled =
      typeof body.codEnabled === "boolean"
        ? body.codEnabled
        : existingProduct.codEnabled;

    const customerArtworkEnabled =
      typeof body.customerArtworkEnabled === "boolean"
        ? body.customerArtworkEnabled
        : existingProduct.customerArtworkEnabled;

    const status =
      typeof body.status === "string"
        ? body.status
        : "ACTIVE";

    const featured =
      typeof body.featured === "boolean"
        ? body.featured
        : false;

    if (!name || !slug || !sku || !categoryId) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Name, slug, SKU and category are required.",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid product price.",
        },
        { status: 400 }
      );
    }

    if (
      discountPrice !== null &&
      (!Number.isFinite(discountPrice) ||
        discountPrice < 0)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid discount price.",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(stock) || stock < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Stock must be a valid number.",
        },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: "Category not found.",
        },
        { status: 400 }
      );
    }

    const duplicate = await prisma.product.findFirst({
      where: {
        OR: [
          { slug },
          { sku },
        ],
        NOT: {
          id,
        },
      },
      select: {
        id: true,
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Another product already uses this slug or SKU.",
        },
        { status: 409 }
      );
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        title: title || null,
        slug,
        sku,
        description,
        image,
        images: [...new Set(images)],
        colors: [...new Set(colors)],
        sizes: [...new Set(sizes)],
        category: { connect: { id: categoryId } },
        price,
        discountPrice,
        stock,
        availability,
        codEnabled,
        customerArtworkEnabled,
        status,
        featured,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Product updated successfully.",
      product,
    });
  } catch (error) {
    console.error("Product PATCH error:", error);

    const auth = authError(error);
    if (auth) return auth;

    return NextResponse.json(
      {
        success: false,
        message: "Unable to update product.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    await requireAdmin();

    const { id } = await context.params;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          message: "Product not found.",
        },
        { status: 404 }
      );
    }

    await prisma.product.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    console.error("Product DELETE error:", error);

    const auth = authError(error);
    if (auth) return auth;

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete product.",
      },
      { status: 500 }
    );
  }
}