import { createHash, randomBytes } from "node:crypto";

export const VERIFICATION_TTL_MS = 30 * 60 * 1000;
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isGmailAddress(email: string): boolean {
  return /^[^\s@]+@gmail\.com$/i.test(email);
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

export function isExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function getVerificationTokenStatus(
  token: { usedAt: Date | null; expiresAt: Date },
  now = new Date(),
): "used" | "expired" | "valid" {
  if (token.usedAt) return "used";
  if (isExpired(token.expiresAt, now)) return "expired";
  return "valid";
}
