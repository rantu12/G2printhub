
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await prisma.customPrintProduct.findMany({
      where: {
        active: true,
        availability: true,
        category: { active: true },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        images: true,
        price: true,
        salePrice: true,
        colors: true,
        sizes: true,
        category: {
          select: { name: true, slug: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, products });
  } catch (error) {
    console.error("Public Custom Print products error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load products." },
      { status: 500 }
    );
  }
}
