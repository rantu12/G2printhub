const artworkTypes = {
  "image/jpeg": {
    extension: "jpg" as const,
    matches: (bytes: Uint8Array) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
  "image/png": {
    extension: "png" as const,
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
    extension: "webp" as const,
    matches: (bytes: Uint8Array) =>
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP",
  },
  "application/pdf": {
    extension: "pdf" as const,
    matches: (bytes: Uint8Array) =>
      bytes.length >= 5 &&
      String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-",
  },
} satisfies Record<
  string,
  { extension: string; matches: (bytes: Uint8Array) => boolean }
>;

export type ArtworkFileValidation =
  | { success: true; extension: "jpg" | "png" | "webp" | "pdf" }
  | { success: false; message: string };

export function validateCustomPrintArtworkFile(
  contentType: string,
  size: number,
  bytes: Uint8Array,
  maximumSize: number,
  acceptedTypes: readonly string[]
): ArtworkFileValidation {
  const type = artworkTypes[contentType as keyof typeof artworkTypes];
  if (!type || !acceptedTypes.includes(contentType)) {
    return { success: false, message: "The selected artwork file type is not supported." };
  }
  if (
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > maximumSize ||
    bytes.byteLength !== size
  ) {
    return { success: false, message: "The artwork file exceeds the product's file-size limit." };
  }
  if (!type.matches(bytes)) {
    return {
      success: false,
      message: "The selected file content does not match its declared type.",
    };
  }
  return { success: true, extension: type.extension };
}

export function validateCustomPrintOriginalImage(
  contentType: string,
  size: number,
  bytes: Uint8Array
): { success: true; extension: "jpg" | "png" | "webp" } | { success: false; message: string } {
  const type = artworkTypes[contentType as keyof typeof artworkTypes];
  if (
    !type ||
    !["image/jpeg", "image/png", "image/webp"].includes(contentType) ||
    !Number.isSafeInteger(size) ||
    size <= 0 ||
    size > 10 * 1024 * 1024 ||
    bytes.byteLength !== size ||
    !type.matches(bytes)
  ) {
    return {
      success: false,
      message: "The original image must be a valid JPG, PNG, or WebP file up to 10 MB.",
    };
  }
  return {
    success: true,
    extension: type.extension as "jpg" | "png" | "webp",
  };
}

export function validateCustomPrintModelFile(
  contentType: string,
  size: number,
  bytes: Uint8Array
): { success: true } | { success: false; message: string } {
  if (
    contentType !== "model/gltf-binary" ||
    !Number.isSafeInteger(size) ||
    size < 12 ||
    size > 20 * 1024 * 1024 ||
    bytes.byteLength !== size ||
    bytes[0] !== 0x67 ||
    bytes[1] !== 0x6c ||
    bytes[2] !== 0x54 ||
    bytes[3] !== 0x46 ||
    bytes[4] !== 0x02 ||
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(
      8,
      true
    ) !== size
  ) {
    return {
      success: false,
      message: "The customized 3D model must be a valid GLB file up to 20 MB.",
    };
  }
  return { success: true };
}
