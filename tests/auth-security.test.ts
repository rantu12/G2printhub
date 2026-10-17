import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpaqueToken,
  getVerificationTokenStatus,
  hashOpaqueToken,
  isExpired,
  isGmailAddress,
  normalizeEmail,
  VERIFICATION_TTL_MS,
} from "../lib/auth-security";

test("Gmail-only validation accepts only @gmail.com, case-insensitively", () => {
  assert.equal(isGmailAddress(normalizeEmail(" Person@GMAIL.COM ")), true);
  assert.equal(isGmailAddress("person@gmail.com.example.org"), false);
  assert.equal(isGmailAddress("person@googlemail.com"), false);
  assert.equal(isGmailAddress("person@example.com"), false);
  assert.equal(isGmailAddress("person@gmail.com\n"), false);
});

test("verification tokens are high entropy and only stored as a hash", () => {
  const token = createOpaqueToken();
  const hash = hashOpaqueToken(token);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);
  assert.equal(hashOpaqueToken(token), hash);
});

test("verification expiry has a strict 30-minute boundary", () => {
  const createdAt = new Date("2026-10-12T12:00:00.000Z");
  const expiresAt = new Date(createdAt.getTime() + VERIFICATION_TTL_MS);
  assert.equal(VERIFICATION_TTL_MS, 30 * 60 * 1000);
  assert.equal(isExpired(expiresAt, new Date(expiresAt.getTime() - 1)), false);
  assert.equal(isExpired(expiresAt, expiresAt), true);
  assert.equal(isExpired(expiresAt, new Date(expiresAt.getTime() + 1)), true);
});

test("verification tokens are accepted once and expired or consumed tokens are rejected", () => {
  const now = new Date("2026-10-12T12:00:00.000Z");
  const liveToken = {
    usedAt: null,
    expiresAt: new Date(now.getTime() + VERIFICATION_TTL_MS),
  };
  assert.equal(getVerificationTokenStatus(liveToken, now), "valid");
  assert.equal(
    getVerificationTokenStatus(
      { ...liveToken, usedAt: new Date(now.getTime() - 1) },
      now,
    ),
    "used",
  );
  assert.equal(
    getVerificationTokenStatus(
      { ...liveToken, expiresAt: now },
      now,
    ),
    "expired",
  );
});
