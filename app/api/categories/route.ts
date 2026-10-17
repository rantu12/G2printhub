import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        _count: {
          select: {
            products: {
              where: {
                availability: true,
                status: "ACTIVE",
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      categories: categories.map(({ _count, ...category }) => ({
        ...category,
        productCount: _count.products,
      })),
    });
  } catch (error) {
    console.error("Public categories GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load categories." },
      { status: 500 }
    );
  }
}
