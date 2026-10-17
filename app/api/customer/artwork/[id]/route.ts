import { readFile, unlink } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { customerArtworkPath } from "@/lib/customer-artwork";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const artwork = await prisma.customerArtwork.findUnique({
      where: { id },
      select: {
        userId: true,
        fileName: true,
        contentType: true,
        storageKey: true,
      },
    });

    if (!artwork || (user.role !== "ADMIN" && artwork.userId !== user.id)) {
      return NextResponse.json(
        { success: false, message: "Artwork not found." },
        { status: 404 }
      );
    }

    if (!artwork.storageKey || !artwork.contentType || !artwork.fileName) {
      return NextResponse.json(
        { success: false, message: "No file is attached to this customization." },
        { status: 404 }
      );
    }

    const bytes = await readFile(customerArtworkPath(artwork.storageKey));
    const safeFileName = artwork.fileName.replace(/["\\\r\n]/g, "_");
    const inline = new URL(request.url).searchParams.get("inline") === "1";

    return new Response(bytes, {
      headers: {
        "Content-Type": artwork.contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeFileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Customer artwork download error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to download artwork." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const artwork = await prisma.customerArtwork.findFirst({
      where: {
        id,
        userId: user.id,
        orderItemId: null,
      },
      select: { id: true, storageKey: true },
    });

    if (!artwork) {
      return NextResponse.json(
        { success: false, message: "Unattached artwork not found." },
        { status: 404 }
      );
    }

    if (artwork.storageKey) {
      await unlink(customerArtworkPath(artwork.storageKey));
    }
    await prisma.customerArtwork.delete({ where: { id: artwork.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer artwork removal error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to remove the uploaded artwork." },
      { status: 500 }
    );
  }
}
