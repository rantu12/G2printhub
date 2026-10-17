import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { artworkDirectory } from "@/lib/customer-artwork";

const keyPath = path.join(artworkDirectory, ".encryption-key");
let encryptionKey: Promise<Buffer> | undefined;

async function loadEncryptionKey(): Promise<Buffer> {
  await mkdir(artworkDirectory, { recursive: true });

  try {
    const existingKey = await readFile(keyPath);
    if (existingKey.byteLength !== 32) {
      throw new Error("INVALID_ARTWORK_ENCRYPTION_KEY");
    }
    return existingKey;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
      throw error;
    }
  }

  const newKey = randomBytes(32);
  try {
    await writeFile(keyPath, newKey, { flag: "wx", mode: 0o600 });
    return newKey;
  } catch (error) {
    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
      throw error;
    }

    const concurrentlyCreatedKey = await readFile(keyPath);
    if (concurrentlyCreatedKey.byteLength !== 32) {
      throw new Error("INVALID_ARTWORK_ENCRYPTION_KEY");
    }
    return concurrentlyCreatedKey;
  }
}

async function getEncryptionKey() {
  encryptionKey ??= loadEncryptionKey();
  return encryptionKey;
}

export async function encryptArtworkSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", await getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export async function decryptArtworkSecret(value: string | null) {
  if (!value) return null;

  const [encodedIv, encodedTag, encodedData, extra] = value.split(".");
  if (!encodedIv || !encodedTag || !encodedData || extra !== undefined) {
    throw new Error("INVALID_ENCRYPTED_ARTWORK_SECRET");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    await getEncryptionKey(),
    Buffer.from(encodedIv, "base64url")
  );
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encodedData, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
