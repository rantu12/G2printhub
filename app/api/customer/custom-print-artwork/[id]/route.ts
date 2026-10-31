
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  readPrivateArtwork,
  removePrivateArtwork,
} from "@/lib/local-private-artwork";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function isSafeStorageKey(value: string) {
  return /^[0-9a-f-]{36}\.(jpg|png|webp|pdf|glb)$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getDownload(value: unknown, key: "original" | "model") {
  if (!isRecord(value) || !isRecord(value.downloads)) return null;
  const download = value.downloads[key];
  if (
    !isRecord(download) ||
    typeof download.storageKey !== "string" ||
    !isSafeStorageKey(download.storageKey) ||
    typeof download.fileName !== "string" ||
    typeof download.contentType !== "string"
  ) {
    return null;
  }
  return {
    storageKey: download.storageKey,
    fileName: download.fileName,
    contentType: download.contentType,
  };
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
    const artwork = await prisma.customPrintArtwork.findUnique({
      where: { id },
      select: {
        userId: true,
        fileName: true,
        contentType: true,
        storageKey: true,
        designConfiguration: true,
      },
    });

    if (!artwork || (user.role !== "ADMIN" && artwork.userId !== user.id)) {
      return NextResponse.json(
        { success: false, message: "Custom Print artwork not found." },
        { status: 404 }
      );
    }

    const fileType = new URL(request.url).searchParams.get("file");
    const optionalDownload =
      fileType === "original" || fileType === "model"
        ? getDownload(artwork.designConfiguration, fileType)
        : null;
    if (
      (fileType && fileType !== "original" && fileType !== "model") ||
      ((fileType === "original" || fileType === "model") && !optionalDownload)
    ) {
      return NextResponse.json(
        { success: false, message: "Custom Print download is unavailable." },
        { status: 404 }
      );
    }

    const selectedDownload = optionalDownload ?? {
      storageKey: artwork.storageKey,
      fileName: artwork.fileName,
      contentType: artwork.contentType,
    };
    if (
      !selectedDownload.storageKey ||
      !selectedDownload.fileName ||
      !selectedDownload.contentType ||
      !isSafeStorageKey(selectedDownload.storageKey)
    ) {
      return NextResponse.json(
        { success: false, message: "Custom Print artwork file is unavailable." },
        { status: 404 }
      );
    }

    const expectedContentType: Record<string, string> = {
      jpg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      pdf: "application/pdf",
      glb: "model/gltf-binary",
    };
    const extension = selectedDownload.storageKey.split(".").pop() ?? "";
    if (expectedContentType[extension] !== selectedDownload.contentType) {
      return NextResponse.json(
        { success: false, message: "Custom Print artwork file type is invalid." },
        { status: 400 }
      );
    }

    let bytes: Buffer;
    try {
      bytes = await readPrivateArtwork(selectedDownload.storageKey);
    } catch {
      return NextResponse.json(
        { success: false, message: "Custom Print artwork file not found in local storage." },
        { status: 404 }
      );
    }

    const safeFileName = selectedDownload.fileName
      .replace(/["\\/\r\n]/g, "_")
      .replace(/[^\x20-\x7E]/g, "_");
    const inline =
      selectedDownload.contentType.startsWith("image/") &&
      new URL(request.url).searchParams.get("inline") === "1";

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": selectedDownload.contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeFileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error(
      "Custom Print artwork GET failed:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { success: false, message: "Unable to retrieve Custom Print artwork." },
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
    const artwork = await prisma.customPrintArtwork.findFirst({
      where: { id, userId: user.id },
      select: { id: true, storageKey: true, designConfiguration: true },
    });

    if (!artwork) {
      return NextResponse.json(
        { success: false, message: "Custom Print artwork not found." },
        { status: 404 }
      );
    }

    const downloads = ["original", "model"]
      .map((key) => getDownload(artwork.designConfiguration, key as "original" | "model"))
      .filter((download): download is NonNullable<typeof download> => Boolean(download));
    const storageKeys = [
      artwork.storageKey,
      ...downloads.map((download) => download.storageKey),
    ].filter((key): key is string => Boolean(key));

    if (storageKeys.some((key) => !isSafeStorageKey(key))) {
      return NextResponse.json(
        { success: false, message: "Invalid Custom Print artwork storage key." },
        { status: 400 }
      );
    }

    await prisma.customPrintArtwork.delete({ where: { id: artwork.id } });

    for (const storageKey of storageKeys) {
      try {
        await removePrivateArtwork(storageKey);
      } catch (error) {
        console.error("Unable to remove deleted Custom Print artwork file:", error);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(
      "Custom Print artwork DELETE failed:",
      error instanceof Error ? error.name : "UnknownError"
    );
    return NextResponse.json(
      { success: false, message: "Unable to remove Custom Print artwork." },
      { status: 500 }
    );
  }
}
