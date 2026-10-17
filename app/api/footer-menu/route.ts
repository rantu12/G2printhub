import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const items = await prisma.footerMenuItem.findMany({
      where: { isActive: true },
      select: {
        id: true,
        label: true,
        href: true,
      },
      orderBy: { position: "asc" },
    });

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Footer menu GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load footer menu." },
      { status: 500 }
    );
  }
}
