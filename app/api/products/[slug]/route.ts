import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;

    const product = await prisma.product.findFirst({
      where: {
        slug,
        availability: true,
        status: "ACTIVE",
      },

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
        {
          status: 404,
        }
      );
    }

    const relatedProducts = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: {
          not: product.id,
        },
        availability: true,
        status: "ACTIVE",
      },

      include: {
        category: true,
      },

      orderBy: [
        {
          featured: "desc",
        },
        {
          createdAt: "desc",
        },
      ],

      take: 4,
    });

    return NextResponse.json({
      success: true,

      product: {
        id: product.id,
        name: product.name,
        title: product.title,
        slug: product.slug,
        sku: product.sku,
        description: product.description,
        image: product.image,
        images: Array.from(
          new Set(
            [product.image, ...product.images].filter(
              (image): image is string => Boolean(image)
            )
          )
        ),
        colors: product.colors,
        sizes: product.sizes,
        price: product.price.toString(),
        discountPrice:
          product.discountPrice?.toString() ?? null,
        stock: product.stock,
        availability: product.availability,
        customerArtworkEnabled: product.customerArtworkEnabled,
        status: product.status,
        featured: product.featured,

        category: {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug,
        },
      },

      relatedProducts: relatedProducts.map((item) => ({
        id: item.id,
        name: item.name,
        title: item.title,
        slug: item.slug,
        image: item.image,
        images: Array.from(
          new Set(
            [item.image, ...item.images].filter(
              (image): image is string => Boolean(image)
            )
          )
        ),
        colors: item.colors,
        sizes: item.sizes,
        price: item.price.toString(),
        discountPrice:
          item.discountPrice?.toString() ?? null,
        stock: item.stock,
        availability: item.availability,
        customerArtworkEnabled: item.customerArtworkEnabled,
        status: item.status,
        featured: item.featured,

        category: {
          id: item.category.id,
          name: item.category.name,
          slug: item.category.slug,
        },
      })),
    });
  } catch (error) {
    console.error("Product details GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load product.",
      },
      {
        status: 500,
      }
    );
  }
}