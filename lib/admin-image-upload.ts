
import { randomUUID } from "node:crypto";
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

type ImageUploadResult =
  | { success: true; image: string }
  | { success: false; status: 400; message: string };

export async function saveUploadedImage(
  file: FormDataEntryValue | null,
  folder: "categories" | "homepage" | "reviews"
): Promise<ImageUploadResult> {
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

  const filename = `${folder}/${randomUUID()}.${imageType.extension}`;

  const blob = await put(filename, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  return {
    success: true,
    image: blob.url,
  };
}

export async function saveAdminImage(
  file: FormDataEntryValue | null,
  folder: "categories" | "homepage"
) {
  return saveUploadedImage(file, folder);
}
