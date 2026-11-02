
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

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

type ImageFolder =
  | "categories"
  | "homepage"
  | "reviews"
  | "custom-print";

type ImageUploadResult =
  | { success: true; image: string }
  | {
      success: false;
      status: 400 | 500 | 503;
      message: string;
    };

type ValidatedImage =
  | { success: true; file: File; bytes: Uint8Array; extension: string }
  | Extract<ImageUploadResult, { success: false }>;

async function validateImage(
  file: FormDataEntryValue | null
): Promise<ValidatedImage> {
  if (!(file instanceof File)) {
    return {
      success: false,
      status: 400,
      message: "Choose an image file to upload.",
    };
  }

  if (file.size === 0 || file.size > maxFileSize) {
    return {
      success: false,
      status: 400,
      message: "Image must be between 1 byte and 5 MB.",
    };
  }

  const imageType = imageTypes[file.type as keyof typeof imageTypes];

  if (!imageType) {
    return {
      success: false,
      status: 400,
      message: "Only JPG, PNG, and WebP images are supported.",
    };
  }

  const imageBytes = new Uint8Array(await file.arrayBuffer());

  if (!imageType.matches(imageBytes)) {
    return {
      success: false,
      status: 400,
      message: "The selected file is not a valid image.",
    };
  }

  return {
    success: true,
    file,
    bytes: imageBytes,
    extension: imageType.extension,
  };
}

export async function saveUploadedImage(
  file: FormDataEntryValue | null,
  folder: ImageFolder
): Promise<ImageUploadResult> {
  const validatedImage = await validateImage(file);
  if (!validatedImage.success) return validatedImage;

  const filename = `${randomUUID()}.${validatedImage.extension}`;
  const relativePath = path.posix.join("uploads", folder, filename);
  const uploadDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    folder
  );
  const destination = path.join(uploadDirectory, filename);

  try {
    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(destination, validatedImage.bytes, { flag: "wx" });

    return {
      success: true,
      image: `/${relativePath}`,
    };
  } catch (error) {
    console.error("Local image storage failed:", error);

    return {
      success: false,
      status: 500,
      message: "Unable to save image locally. Check the uploads folder permissions.",
    };
  }
}

export async function saveAdminImage(
  file: FormDataEntryValue | null,
  folder: "categories" | "homepage" | "custom-print" | "site-identity"
) {
  const validatedImage = await validateImage(file);
  if (!validatedImage.success) return validatedImage;

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    return {
      success: false as const,
      status: 503 as const,
      message:
        "Image storage is not configured. Set up Vercel Blob for this environment.",
    };
  }

  const filename = `${folder}/${randomUUID()}.${validatedImage.extension}`;
  const blob = await put(filename, validatedImage.file, {
    access: "public",
    addRandomSuffix: false,
    contentType: validatedImage.file.type,
  });

  return {
    success: true as const,
    image: blob.url,
  };
}

const max3DModelSize = 20 * 1024 * 1024;

export type ModelUploadResult =
  | { success: true; modelUrl: string }
  | {
      success: false;
      status: 400 | 500;
      message: string;
    };

export async function saveAdmin3DModel(
  file: FormDataEntryValue | null
): Promise<ModelUploadResult> {
  if (!(file instanceof File)) {
    return {
      success: false,
      status: 400,
      message: "Choose a GLB file to upload.",
    };
  }

  if (
    !file.name.toLowerCase().endsWith(".glb") ||
    file.size < 12 ||
    file.size > max3DModelSize
  ) {
    return {
      success: false,
      status: 400,
      message: "Choose a GLB file between 12 bytes and 20 MB.",
    };
  }

  let bytes: Uint8Array;

  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return {
      success: false,
      status: 400,
      message: "Unable to read the uploaded model.",
    };
  }

  // GLB header:
  // magic = "glTF", version = 2, declared length = file length
  const view = new DataView(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength
  );

  const hasValidHeader =
    bytes[0] === 0x67 &&
    bytes[1] === 0x6c &&
    bytes[2] === 0x54 &&
    bytes[3] === 0x46 &&
    view.getUint32(4, true) === 2 &&
    view.getUint32(8, true) === bytes.byteLength;

  if (!hasValidHeader) {
    return {
      success: false,
      status: 400,
      message: "The file does not have a valid GLB v2 header.",
    };
  }

  const filename = `${randomUUID()}.glb`;
  const relativePath = path.posix.join(
    "uploads",
    "custom-print",
    "models",
    filename
  );

  const uploadDirectory = path.join(
    process.cwd(),
    "public",
    "uploads",
    "custom-print",
    "models"
  );

  try {
    await mkdir(uploadDirectory, { recursive: true });

    await writeFile(
      path.join(uploadDirectory, filename),
      bytes,
      { flag: "wx" }
    );

    return {
      success: true,
      modelUrl: `/${relativePath}`,
    };
  } catch (error) {
    console.error("Local 3D model storage failed:", error);

    return {
      success: false,
      status: 500,
      message: "Unable to save the 3D model. Check uploads folder permissions.",
    };
  }
}
