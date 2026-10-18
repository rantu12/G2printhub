
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

const maxFileSize = 5 * 1024 * 1024;

const imageTypes = {
  "image/jpeg": {
    extension: "jpg",
    matches: (bytes: Uint8Array) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    matches: (bytes: Uint8Array) =>
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a,
  },
  "image/webp": {
    extension: "webp",
    matches: (bytes: Uint8Array) =>
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP",
  },
} satisfies Record<
  string,
  { extension: string; matches: (bytes: Uint8Array) => boolean }
>;

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "Choose an image file to upload." },
        { status: 400 }
      );
    }

    if (file.size === 0 || file.size > maxFileSize) {
      return NextResponse.json(
        { success: false, message: "Image must be between 1 byte and 5 MB." },
        { status: 400 }
      );
    }

    const imageType = imageTypes[file.type as keyof typeof imageTypes];

    if (!imageType) {
      return NextResponse.json(
        {
          success: false,
          message: "Only JPG, PNG, and WebP images are supported.",
        },
        { status: 400 }
      );
    }

    const imageBytes = new Uint8Array(await file.arrayBuffer());

    if (!imageType.matches(imageBytes)) {
      return NextResponse.json(
        { success: false, message: "The selected file is not a valid image." },
        { status: 400 }
      );
    }

    const filename = `products/${randomUUID()}.${imageType.extension}`;

    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type,
    });

    return NextResponse.json({
      success: true,
      image: blob.url,
    });
  } catch (error) {
    console.error("Product image upload error:", error);

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
      { success: false, message: "Unable to upload product image." },
      { status: 500 }
    );
  }
}
