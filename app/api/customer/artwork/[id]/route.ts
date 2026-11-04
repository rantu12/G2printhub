
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  readPrivateArtwork,
  removePrivateArtwork,
} from "@/lib/private-artwork-storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function isSafeStorageKey(value: string) {
  return /^[0-9a-f-]{36}\.(jpg|pdf)$/.test(value);
}

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

    if (
      !artwork.storageKey ||
      !artwork.fileName ||
      !artwork.contentType ||
      !isSafeStorageKey(artwork.storageKey) ||
      !["image/jpeg", "application/pdf"].includes(artwork.contentType)
    ) {
      return NextResponse.json(
        { success: false, message: "Artwork file is unavailable." },
        { status: 404 }
      );
    }

    const extension = artwork.storageKey.endsWith(".pdf") ? "pdf" : "jpg";
    if (
      (extension === "pdf" && artwork.contentType !== "application/pdf") ||
      (extension === "jpg" && artwork.contentType !== "image/jpeg")
    ) {
      return NextResponse.json(
        { success: false, message: "Artwork file type is invalid." },
        { status: 400 }
      );
    }

    const bytes = await readPrivateArtwork(artwork.storageKey);

    const safeFileName = artwork.fileName.replace(/["\\\r\n]/g, "_");
    const inline = new URL(request.url).searchParams.get("inline") === "1";

    return new Response(new Uint8Array(bytes), {
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

    if (artwork.storageKey && !isSafeStorageKey(artwork.storageKey)) {
      return NextResponse.json(
        { success: false, message: "Invalid artwork storage key." },
        { status: 400 }
      );
    }

    await prisma.customerArtwork.delete({ where: { id: artwork.id } });

    if (artwork.storageKey) {
      try {
        await removePrivateArtwork(artwork.storageKey);
      } catch (error) {
        console.error("Unable to remove deleted customer artwork file:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer artwork removal error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to remove the uploaded artwork." },
      { status: 500 }
    );
  }
}
