
import { NextResponse } from "next/server";
import { encryptArtworkSecret } from "@/lib/artwork-secrets";
import { getCurrentUser } from "@/lib/auth";
import {
  removePrivateArtwork,
  savePrivateArtwork,
} from "@/lib/local-private-artwork";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const maxFileSize = 10 * 1024 * 1024;

function authenticationError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please sign in before uploading artwork." },
      { status: 401 }
    );
  }
  return null;
}

export async function POST(request: Request) {
  let uploadedStorageKey: string | undefined;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Please sign in before uploading artwork." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const productId = formData.get("productId");
    const existingId = formData.get("existingId");
    const pdfPassword = formData.get("pdfPassword");

    if (
      (file !== null && !(file instanceof File)) ||
      typeof productId !== "string" ||
      (existingId !== null && typeof existingId !== "string") ||
      typeof pdfPassword !== "string"
    ) {
      return NextResponse.json(
        { success: false, message: "Provide valid product customization details." },
        { status: 400 }
      );
    }

    if (pdfPassword.length > 256) {
      return NextResponse.json(
        { success: false, message: "The PDF password is too long." },
        { status: 400 }
      );
    }

    const uploadedFile = file instanceof File ? file : null;

    if (uploadedFile && (uploadedFile.size === 0 || uploadedFile.size > maxFileSize)) {
      return NextResponse.json(
        { success: false, message: "The file must be between 1 byte and 10 MB." },
        { status: 400 }
      );
    }

    const types = {
      "image/jpeg": {
        extension: "jpg" as const,
        matches: (bytes: Uint8Array) =>
          bytes.length >= 3 &&
          bytes[0] === 0xff &&
          bytes[1] === 0xd8 &&
          bytes[2] === 0xff,
      },
      "application/pdf": {
        extension: "pdf" as const,
        matches: (bytes: Uint8Array) =>
          bytes.length >= 5 &&
          String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-",
      },
    };

    const fileType = uploadedFile
      ? types[uploadedFile.type as keyof typeof types]
      : null;

    if (uploadedFile && !fileType) {
      return NextResponse.json(
        { success: false, message: "Only JPG and PDF files are supported." },
        { status: 400 }
      );
    }

    const bytes = uploadedFile
      ? new Uint8Array(await uploadedFile.arrayBuffer())
      : null;

    if (fileType && bytes && !fileType.matches(bytes)) {
      return NextResponse.json(
        { success: false, message: "The selected file is not a valid JPG or PDF." },
        { status: 400 }
      );
    }

    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        status: "ACTIVE",
        availability: true,
        customerArtworkEnabled: true,
      },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "The selected product is not available for artwork upload." },
        { status: 400 }
      );
    }

    const existingArtwork = existingId
      ? await prisma.customerArtwork.findFirst({
          where: {
            id: existingId,
            userId: user.id,
            productId: product.id,
            orderItemId: null,
          },
          select: {
            id: true,
            storageKey: true,
            fileName: true,
            contentType: true,
            fileSize: true,
          },
        })
      : null;

    if (existingId && !existingArtwork) {
      return NextResponse.json(
        { success: false, message: "Refresh the page and try again." },
        { status: 409 }
      );
    }

    if (!uploadedFile && !existingArtwork?.storageKey && !pdfPassword) {
      return NextResponse.json(
        { success: false, message: "Choose a JPG or PDF file to upload." },
        { status: 400 }
      );
    }

    if (
      pdfPassword &&
      !uploadedFile &&
      existingArtwork?.contentType !== "application/pdf"
    ) {
      return NextResponse.json(
        { success: false, message: "Upload a PDF before entering its password." },
        { status: 400 }
      );
    }

    if (pdfPassword && uploadedFile && uploadedFile.type !== "application/pdf") {
      return NextResponse.json(
        { success: false, message: "A PDF password can only be used with a PDF file." },
        { status: 400 }
      );
    }

    let storageKey = existingArtwork?.storageKey ?? null;
    let fileName = existingArtwork?.fileName ?? null;
    let contentType = existingArtwork?.contentType ?? null;
    let fileSize = existingArtwork?.fileSize ?? null;

    if (uploadedFile && fileType && bytes) {
      storageKey = await savePrivateArtwork(bytes, fileType.extension);
      uploadedStorageKey = storageKey;
      fileName = uploadedFile.name.replace(/["\\\r\n]/g, "_").slice(0, 255)
        || `artwork.${fileType.extension}`;
      contentType = uploadedFile.type;
      fileSize = uploadedFile.size;
    }

    const encryptedPdfPassword = pdfPassword
      ? await encryptArtworkSecret(pdfPassword)
      : null;

    const data = {
      fileName,
      contentType,
      fileSize,
      storageKey,
      pdfPasswordEncrypted: encryptedPdfPassword,
    };

    const artwork = existingArtwork
      ? await prisma.customerArtwork.update({
          where: { id: existingArtwork.id },
          data,
          select: { id: true, fileName: true },
        })
      : await prisma.customerArtwork.create({
          data: { ...data, userId: user.id, productId: product.id },
          select: { id: true, fileName: true },
        });

    uploadedStorageKey = undefined;

    if (
      uploadedFile &&
      existingArtwork?.storageKey &&
      existingArtwork.storageKey !== storageKey
    ) {
      try {
        await removePrivateArtwork(existingArtwork.storageKey);
      } catch (error) {
        console.error("Unable to remove replaced local artwork:", error);
      }
    }

    return NextResponse.json(
      { success: true, artwork },
      { status: existingArtwork ? 200 : 201 }
    );
  } catch (error) {
    if (uploadedStorageKey) {
      try {
        await removePrivateArtwork(uploadedStorageKey);
      } catch (cleanupError) {
        console.error("Artwork upload cleanup failed:", cleanupError);
      }
    }

    const auth = authenticationError(error);
    if (auth) return auth;

    console.error("Customer artwork upload error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to upload artwork." },
      { status: 500 }
    );
  }
}
