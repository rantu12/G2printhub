import { randomUUID } from "node:crypto";
import { mkdir, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { artworkDirectory, customerArtworkPath } from "@/lib/customer-artwork";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const stagedFiles: { originalPath: string; stagedPath: string }[] = [];

  try {
    await requireAdmin();

    const artworks = await prisma.customerArtwork.findMany({
      select: { id: true, storageKey: true },
    });

    if (artworks.some((artwork) => artwork.storageKey)) {
      await mkdir(artworkDirectory, { recursive: true });
    }

    for (const artwork of artworks) {
      if (!artwork.storageKey) continue;

      const originalPath = customerArtworkPath(artwork.storageKey);
      const stagedPath = path.join(
        artworkDirectory,
        `${randomUUID()}${path.extname(artwork.storageKey)}`
      );
      await rename(originalPath, stagedPath);
      stagedFiles.push({ originalPath, stagedPath });
    }

    const [deletedOrders, deletedUploads] = await prisma.$transaction(
      async (tx) => {
        const uploads = await tx.customerArtwork.deleteMany();
        const orders = await tx.order.deleteMany();
        return [orders.count, uploads.count] as const;
      }
    );

    for (const file of stagedFiles) {
      try {
        await unlink(file.stagedPath);
      } catch (error) {
        console.error("Unable to remove cleared customer artwork file:", error);
        return NextResponse.json(
          {
            success: false,
            message:
              "Orders and upload records were cleared, but a private artwork file could not be removed. Contact support.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      deletedOrders,
      deletedUploads,
      message: "All orders and customer uploads were cleared.",
    });
  } catch (error) {
    for (const file of stagedFiles.reverse()) {
      try {
        await rename(file.stagedPath, file.originalPath);
      } catch (restoreError) {
        console.error("Unable to restore staged artwork file:", restoreError);
      }
    }

    console.error("Admin clear all orders error:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unable to clear all orders and customer uploads.",
      },
      { status: 500 }
    );
  }
}
