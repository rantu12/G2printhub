
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const storageDirectory = path.join(process.cwd(), "private-uploads", "artwork");

export type ArtworkExtension = "jpg" | "png" | "webp" | "pdf" | "glb";

function isSafeArtworkKey(key: string): boolean {
  return /^[0-9a-f-]{36}\.(jpg|png|webp|pdf|glb)$/.test(key);
}

function resolveArtworkPath(key: string): string {
  if (!isSafeArtworkKey(key)) {
    throw new Error("INVALID_ARTWORK_STORAGE_KEY");
  }

  const resolved = path.resolve(storageDirectory, key);
  const root = path.resolve(storageDirectory);

  if (path.dirname(resolved) !== root) {
    throw new Error("INVALID_ARTWORK_STORAGE_PATH");
  }

  return resolved;
}

export async function savePrivateArtwork(
  bytes: Uint8Array,
  extension: ArtworkExtension
): Promise<string> {
  const key = `${randomUUID()}.${extension}`;
  const filePath = resolveArtworkPath(key);

  await mkdir(storageDirectory, { recursive: true });
  await writeFile(filePath, bytes, { flag: "wx" });

  return key;
}

export async function readPrivateArtwork(
  key: string
): Promise<Buffer> {
  return readFile(resolveArtworkPath(key));
}

export async function removePrivateArtwork(
  key: string
): Promise<void> {
  await rm(resolveArtworkPath(key), { force: true });
}
