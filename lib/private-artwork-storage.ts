
import { randomUUID } from "node:crypto";
import { artworkBucket, getSupabaseArtwork } from "./supabase-artwork";

export type ArtworkExtension = "jpg" | "png" | "webp" | "pdf" | "glb";

const contentTypes: Record<ArtworkExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
  glb: "model/gltf-binary",
};

function isSafeArtworkKey(key: string): key is `${string}.${ArtworkExtension}` {
  return /^[0-9a-f-]{36}\.(jpg|png|webp|pdf|glb)$/.test(key);
}

function assertSafeArtworkKey(key: string): asserts key is `${string}.${ArtworkExtension}` {
  if (!isSafeArtworkKey(key)) {
    throw new Error("INVALID_ARTWORK_STORAGE_KEY");
  }
}

export async function savePrivateArtwork(
  bytes: Uint8Array,
  extension: ArtworkExtension
): Promise<string> {
  const key = `${randomUUID()}.${extension}`;
  const { error } = await getSupabaseArtwork()
    .storage
    .from(artworkBucket)
    .upload(key, Buffer.from(bytes), {
      contentType: contentTypes[extension],
      upsert: false,
    });

  if (error) {
    throw new Error("SUPABASE_ARTWORK_UPLOAD_FAILED", { cause: error });
  }

  return key;
}

export async function readPrivateArtwork(
  key: string
): Promise<Buffer> {
  assertSafeArtworkKey(key);

  const { data, error } = await getSupabaseArtwork()
    .storage
    .from(artworkBucket)
    .download(key);

  if (error) {
    throw new Error("SUPABASE_ARTWORK_DOWNLOAD_FAILED", { cause: error });
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function removePrivateArtwork(
  key: string
): Promise<void> {
  assertSafeArtworkKey(key);

  const { error } = await getSupabaseArtwork()
    .storage
    .from(artworkBucket)
    .remove([key]);

  if (error) {
    throw new Error("SUPABASE_ARTWORK_REMOVE_FAILED", { cause: error });
  }
}
