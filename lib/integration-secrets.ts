import { prisma } from "@/lib/prisma";
import {
  assertIntegrationEncryptionKey,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "@/lib/integration-secret-crypto";

export const INTEGRATION_SECRET_KEYS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "CASHFREE_CLIENT_ID",
  "CASHFREE_CLIENT_SECRET",
  "CASHFREE_ENVIRONMENT",
] as const;

export type IntegrationSecretKey = (typeof INTEGRATION_SECRET_KEYS)[number];

const secretKeySet = new Set<string>(INTEGRATION_SECRET_KEYS);

export function isIntegrationSecretKey(
  value: string
): value is IntegrationSecretKey {
  return secretKeySet.has(value);
}

export async function getIntegrationValue(
  key: IntegrationSecretKey
): Promise<string | undefined> {
  const stored = await prisma.integrationSecret.findUnique({
    where: { key },
    select: { encryptedValue: true },
  });
  if (stored) return decryptIntegrationSecret(stored.encryptedValue);
  return process.env[key]?.trim() || undefined;
}

export async function getIntegrationOverrides(): Promise<
  Partial<Record<IntegrationSecretKey, true>>
> {
  const rows = await prisma.integrationSecret.findMany({
    select: { key: true },
  });
  return rows.reduce<Partial<Record<IntegrationSecretKey, true>>>(
    (overrides, row) => {
      if (isIntegrationSecretKey(row.key)) overrides[row.key] = true;
      return overrides;
    },
    {}
  );
}

export async function saveIntegrationSecrets(
  values: Partial<Record<IntegrationSecretKey, string>>,
  clearKeys: IntegrationSecretKey[]
): Promise<void> {
  const entries = Object.entries(values);
  for (const [key, value] of entries) {
    if (!isIntegrationSecretKey(key)) {
      throw new Error("Unsupported integration credential.");
    }
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Integration credentials must not be empty.");
    }
  }
  if (clearKeys.some((key) => !isIntegrationSecretKey(key))) {
    throw new Error("Unsupported integration credential.");
  }
  if (entries.length > 0 || clearKeys.length > 0) {
    assertIntegrationEncryptionKey();
  }

  await prisma.$transaction(async (transaction) => {
    for (const key of clearKeys) {
      await transaction.integrationSecret.deleteMany({ where: { key } });
    }
    for (const [key, value] of entries) {
      if (!isIntegrationSecretKey(key) || typeof value !== "string") {
        throw new Error("Unsupported integration credential.");
      }
      await transaction.integrationSecret.upsert({
        where: { key },
        create: {
          key,
          encryptedValue: encryptIntegrationSecret(value.trim()),
        },
        update: { encryptedValue: encryptIntegrationSecret(value.trim()) },
      });
    }
  });
}
