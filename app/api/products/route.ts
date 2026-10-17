import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search")?.trim() || "";
    const category = searchParams.get("category")?.trim() || "";
    const categories = await prisma.category.findMany({
      where: { active: true },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
    let categoryId: string | undefined;

    if (category) {
      const selectedCategory = categories.find(
        (item) => item.slug === category
      );

      if (!selectedCategory) {
        return NextResponse.json({
          success: true,
          products: [],
          categories,
        });
      }

      categoryId = selectedCategory.id;
    }

    const products = await prisma.product.findMany({
      where: {
        availability: true,
        status: "ACTIVE",
        ...(categoryId ? { categoryId } : {}),

        ...(search
          ? {
              OR: [
                {
                  name: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  title: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),

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
    });

    const productIds = products.map((product) => product.id);
    const ratings = productIds.length
      ? await prisma.productReview.groupBy({
          by: ["productId"],
          where: { productId: { in: productIds } },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : [];
    const ratingByProduct = new Map(
      ratings.map((rating) => [
        rating.productId,
        {
          average: rating._avg.rating,
          count: rating._count._all,
        },
      ])
    );

    const safeProducts = products.map((product) => ({
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
      status: product.status,
      featured: product.featured,
      customerArtworkEnabled: product.customerArtworkEnabled,
      createdAt: product.createdAt.toISOString(),
      rating: ratingByProduct.get(product.id)?.average ?? null,
      reviewCount: ratingByProduct.get(product.id)?.count ?? 0,
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
    }));

    return NextResponse.json({
      success: true,
      products: safeProducts,
      categories,
    });
  } catch (error) {
    console.error("Public products GET error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load products.",
      },
      {
        status: 500,
      }
    );
  }
}