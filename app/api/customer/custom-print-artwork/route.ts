
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  removePrivateArtwork,
  savePrivateArtwork,
} from "@/lib/local-private-artwork";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

import { parseCustomPrintDesignConfiguration } from "@/lib/custom-print-validation";
import {
  validateCustomPrintArtworkFile,
  validateCustomPrintModelFile,
  validateCustomPrintOriginalImage,
} from "@/lib/custom-print-artwork-validation";

export const runtime = "nodejs";

const maxFileSize = 10 * 1024 * 1024;
const safeDownloadKey = /^[0-9a-f-]{36}\.(jpg|png|webp|pdf|glb)$/;

type ArtworkDownload = {
  storageKey: string;
  fileName: string;
  contentType: string;
  fileSize: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeFileName(value: string, fallback: string) {
  return value.replace(/[\\/\r\n"]/g, "_").slice(0, 255) || fallback;
}

function getDownloadMetadata(value: unknown): {
  original: ArtworkDownload | null;
  model: ArtworkDownload | null;
} {
  const downloads = isRecord(value) && isRecord(value.downloads)
    ? value.downloads
    : {};

  function parse(item: unknown): ArtworkDownload | null {
    if (
      !isRecord(item) ||
      typeof item.storageKey !== "string" ||
      !safeDownloadKey.test(item.storageKey) ||
      typeof item.fileName !== "string" ||
      typeof item.contentType !== "string" ||
      typeof item.fileSize !== "number"
    ) {
      return null;
    }
    return {
      storageKey: item.storageKey,
      fileName: item.fileName,
      contentType: item.contentType,
      fileSize: item.fileSize,
    };
  }

  return {
    original: parse(downloads.original),
    model: parse(downloads.model),
  };
}

function getProductArtworkSettings(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      enabled: true,
      maxFileSize,
      acceptedTypes: ["image/jpeg", "image/png", "application/pdf"],
    };
  }

  const settings = value as Record<string, unknown>;
  const enabled = settings.allowArtwork !== false;
  const configuredLimit =
    typeof settings.maxArtworkFileSize === "number" &&
    Number.isInteger(settings.maxArtworkFileSize)
      ? settings.maxArtworkFileSize
      : maxFileSize;

  const acceptedTypes = Array.isArray(settings.acceptedArtworkTypes)
    ? settings.acceptedArtworkTypes.filter(
        (type): type is string => typeof type === "string"
      )
    : ["image/jpeg", "image/png", "application/pdf"];

  return {
    enabled,
    maxFileSize: Math.min(maxFileSize, configuredLimit),
    acceptedTypes: [...new Set([...acceptedTypes, "image/png"])],
  };
}

export async function POST(request: Request) {
  const newlyUploadedStorageKeys: string[] = [];

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Please sign in before uploading artwork." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const originalFileEntry = formData.get("originalFile");
    const modelFileEntry = formData.get("modelFile");
    const productIdEntry = formData.get("productId");
    const existingIdEntry = formData.get("existingId");
    const configEntry = formData.get("designConfiguration");

    if (
      (fileEntry !== null && !(fileEntry instanceof File)) ||
      (originalFileEntry !== null && !(originalFileEntry instanceof File)) ||
      (modelFileEntry !== null && !(modelFileEntry instanceof File)) ||
      typeof productIdEntry !== "string" ||
      !productIdEntry.trim() ||
      (existingIdEntry !== null &&
        (typeof existingIdEntry !== "string" || !existingIdEntry.trim())) ||
      (configEntry !== null && typeof configEntry !== "string")
    ) {
      return NextResponse.json(
        { success: false, message: "Provide valid Custom Print artwork details." },
        { status: 400 }
      );
    }

    let rawConfiguration: unknown = { elements: [] };

    if (typeof configEntry === "string") {
      try {
        rawConfiguration = JSON.parse(configEntry) as unknown;
      } catch {
        return NextResponse.json(
          { success: false, message: "Invalid design configuration JSON." },
          { status: 400 }
        );
      }
    }

    const configuration = parseCustomPrintDesignConfiguration(rawConfiguration);

    if (!configuration.success) {
      return NextResponse.json(
        { success: false, message: configuration.message },
        { status: 400 }
      );
    }

    const file = fileEntry instanceof File ? fileEntry : null;
    const originalFile = originalFileEntry instanceof File ? originalFileEntry : null;
    const modelFile = modelFileEntry instanceof File ? modelFileEntry : null;

    if (file && (file.size <= 0 || file.size > maxFileSize)) {
      return NextResponse.json(
        { success: false, message: "The file must be between 1 byte and 10 MB." },
        { status: 400 }
      );
    }

    const product = await prisma.customPrintProduct.findFirst({
      where: {
        id: productIdEntry.trim(),
        active: true,
        availability: true,
        category: { active: true },
      },
      select: { id: true, customizationSettings: true },
    });

    if (!product) {
      return NextResponse.json(
        { success: false, message: "The selected Custom Print product is unavailable." },
        { status: 400 }
      );
    }

    const settings = getProductArtworkSettings(product.customizationSettings);

    if (!settings.enabled) {
      return NextResponse.json(
        { success: false, message: "Artwork uploads are not enabled for this product." },
        { status: 400 }
      );
    }

    const existingId =
      typeof existingIdEntry === "string" ? existingIdEntry.trim() : null;

    const existingArtwork = existingId
      ? await prisma.customPrintArtwork.findFirst({
          where: {
            id: existingId,
            userId: user.id,
            productId: product.id,
          },
          select: {
            id: true,
            storageKey: true,
            fileName: true,
            contentType: true,
            fileSize: true,
            designConfiguration: true,
          },
        })
      : null;

    if (existingId && !existingArtwork) {
      return NextResponse.json(
        { success: false, message: "Custom Print artwork not found for this product." },
        { status: 404 }
      );
    }

    if (!file && !existingArtwork?.storageKey) {
      return NextResponse.json(
        { success: false, message: "Choose a JPG or PDF file to upload." },
        { status: 400 }
      );
    }

    const bytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
    const originalBytes = originalFile
      ? new Uint8Array(await originalFile.arrayBuffer())
      : null;
    const modelBytes = modelFile
      ? new Uint8Array(await modelFile.arrayBuffer())
      : null;

    const fileValidation =
      file && bytes
        ? validateCustomPrintArtworkFile(
            file.type,
            file.size,
            bytes,
            settings.maxFileSize,
            settings.acceptedTypes
          )
        : null;

    if (fileValidation && !fileValidation.success) {
      return NextResponse.json(
        { success: false, message: fileValidation.message },
        { status: 400 }
      );
    }

    const originalValidation =
      originalFile && originalBytes
        ? validateCustomPrintOriginalImage(
            originalFile.type,
            originalFile.size,
            originalBytes
          )
        : null;
    if (originalValidation && !originalValidation.success) {
      return NextResponse.json(
        { success: false, message: originalValidation.message },
        { status: 400 }
      );
    }

    const modelValidation =
      modelFile && modelBytes
        ? validateCustomPrintModelFile(
            modelFile.type,
            modelFile.size,
            modelBytes
          )
        : null;
    if (modelValidation && !modelValidation.success) {
      return NextResponse.json(
        { success: false, message: modelValidation.message },
        { status: 400 }
      );
    }

    let storageKey = existingArtwork?.storageKey ?? null;
    let fileName = existingArtwork?.fileName ?? null;
    let contentType = existingArtwork?.contentType ?? null;
    let fileSize = existingArtwork?.fileSize ?? null;
    const priorDownloads = getDownloadMetadata(
      existingArtwork?.designConfiguration
    );
    let originalDownload = priorDownloads.original;
    let modelDownload = priorDownloads.model;

    if (file && fileValidation?.success && bytes) {
      storageKey = await savePrivateArtwork(bytes, fileValidation.extension);
      newlyUploadedStorageKeys.push(storageKey);
      fileName = file.name.replace(/[\r\n"]/g, "_").slice(0, 255)
        || `artwork.${fileValidation.extension}`;
      contentType = file.type;
      fileSize = file.size;
    }

    if (originalFile && originalBytes && originalValidation?.success) {
      const originalStorageKey = await savePrivateArtwork(
        originalBytes,
        originalValidation.extension
      );
      newlyUploadedStorageKeys.push(originalStorageKey);
      originalDownload = {
        storageKey: originalStorageKey,
        fileName: sanitizeFileName(originalFile.name, "original-image"),
        contentType: originalFile.type,
        fileSize: originalFile.size,
      };
    }

    if (modelFile && modelBytes && modelValidation?.success) {
      const modelStorageKey = await savePrivateArtwork(modelBytes, "glb");
      newlyUploadedStorageKeys.push(modelStorageKey);
      modelDownload = {
        storageKey: modelStorageKey,
        fileName: sanitizeFileName(modelFile.name, "custom-print-model.glb"),
        contentType: "model/gltf-binary",
        fileSize: modelFile.size,
      };
    }

    const designConfiguration = {
      ...(configuration.value as Record<string, unknown>),
      downloads: {
        ...(originalDownload ? { original: originalDownload } : {}),
        ...(modelDownload ? { model: modelDownload } : {}),
      },
    } as Prisma.InputJsonValue;

    const data = {
      fileName,
      contentType,
      fileSize,
      storageKey,
      designConfiguration,
    };

    const artwork = existingArtwork
      ? await prisma.customPrintArtwork.update({
          where: { id: existingArtwork.id },
          data,
          select: {
            id: true,
            fileName: true,
            contentType: true,
            fileSize: true,
            designConfiguration: true,
          },
        })
      : await prisma.customPrintArtwork.create({
          data: { ...data, userId: user.id, productId: product.id },
          select: {
            id: true,
            fileName: true,
            contentType: true,
            fileSize: true,
            designConfiguration: true,
          },
        });

    const nextStorageKeys = new Set(
      [storageKey, originalDownload?.storageKey, modelDownload?.storageKey]
        .filter((key): key is string => Boolean(key))
    );
    const priorStorageKeys = [
      existingArtwork?.storageKey,
      priorDownloads.original?.storageKey,
      priorDownloads.model?.storageKey,
    ];
    for (const priorKey of priorStorageKeys) {
      if (priorKey && !nextStorageKeys.has(priorKey)) {
        try {
          await removePrivateArtwork(priorKey);
        } catch (error) {
          console.error("Unable to remove replaced Custom Print artwork file:", error);
        }
      }
    }
    newlyUploadedStorageKeys.length = 0;

    return NextResponse.json(
      { success: true, artwork },
      { status: existingArtwork ? 200 : 201 }
    );
  } catch (error) {
    for (const storageKey of newlyUploadedStorageKeys) {
      try {
        await removePrivateArtwork(storageKey);
      } catch (cleanupError) {
        console.error("Custom Print artwork cleanup failed:", cleanupError);
      }
    }

    console.error(
      "Custom Print artwork POST failed:",
      error instanceof Error ? error.name : "UnknownError"
    );

    return NextResponse.json(
      { success: false, message: "Unable to save Custom Print artwork." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Please sign in." },
        { status: 401 }
      );
    }

    const productId = new URL(request.url).searchParams.get("productId");

    if (!productId?.trim()) {
      return NextResponse.json(
        { success: false, message: "Product ID is required." },
        { status: 400 }
      );
    }

    const artwork = await prisma.customPrintArtwork.findFirst({
      where: {
        userId: user.id,
        productId: productId.trim(),
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        fileName: true,
        contentType: true,
        fileSize: true,
        designConfiguration: true,
      },
    });

    return NextResponse.json({ success: true, artwork });
  } catch (error) {
    console.error(
      "Custom Print artwork lookup failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { success: false, message: "Unable to load saved artwork." },
      { status: 500 }
    );
  }
}
