import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

function encryptionKey(): Buffer {
  const configured = process.env.INTEGRATION_SECRETS_KEY?.trim() ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(configured)) {
    throw new Error(
      "INTEGRATION_SECRETS_KEY must be set to 32 random bytes encoded as 64 hexadecimal characters."
    );
  }
  return Buffer.from(configured, "hex");
}

export function assertIntegrationEncryptionKey(): void {
  encryptionKey();
}

export function encryptIntegrationSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(":");
}

export function decryptIntegrationSecret(value: string): string {
  const [ivValue, tagValue, encryptedValue, ...unexpected] = value.split(":");
  if (!ivValue || !tagValue || !encryptedValue || unexpected.length > 0) {
    throw new Error("Stored integration credential has an invalid format.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivValue, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
