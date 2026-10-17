import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isProductSize } from "@/lib/product-variants";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();

    const products = await prisma.product.findMany({
      include: {
        category: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Admin products GET error:", error);

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

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load products.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

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
      : [];
    const colorList: unknown[] = Array.isArray(body.colors)
      ? body.colors
      : [];
    const sizeList: unknown[] = Array.isArray(body.sizes)
      ? body.sizes
      : [];
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
      colors.some(
        (item) => !allowedColors.has(item)
      )
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
      (!Number.isFinite(discountPrice) || discountPrice < 0)
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
          message: "Stock must be a valid positive number.",
        },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: "Category not found.",
        },
        { status: 404 }
      );
    }

    const existing = await prisma.product.findFirst({
      where: {
        OR: [
          {
            slug,
          },
          {
            sku,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "A product with this slug or SKU already exists.",
        },
        { status: 409 }
      );
    }

    const product = await prisma.product.create({
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
        price,
        discountPrice,
        stock,
        category: { connect: { id: categoryId } },
        availability:
          typeof body.availability === "boolean"
            ? body.availability
            : true,
        codEnabled:
          typeof body.codEnabled === "boolean"
            ? body.codEnabled
            : true,
        customerArtworkEnabled:
          typeof body.customerArtworkEnabled === "boolean"
            ? body.customerArtworkEnabled
            : true,
        status:
          typeof body.status === "string"
            ? body.status
            : "ACTIVE",
        featured:
          typeof body.featured === "boolean"
            ? body.featured
            : false,
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Product created successfully.",
        product,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Admin product POST error:", error);

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

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create product.",
      },
      { status: 500 }
    );
  }
}