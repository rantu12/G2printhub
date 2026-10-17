import assert from "node:assert/strict";
import test from "node:test";
import {
  assertIntegrationEncryptionKey,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "../lib/integration-secret-crypto";

test("integration credentials encrypt and decrypt with a configured key", () => {
  const previousKey = process.env.INTEGRATION_SECRETS_KEY;
  process.env.INTEGRATION_SECRETS_KEY = "ab".repeat(32);
  try {
    const encrypted = encryptIntegrationSecret("credential-value");
    assert.notEqual(encrypted, "credential-value");
    assert.equal(decryptIntegrationSecret(encrypted), "credential-value");
    const [iv, tag, ciphertext] = encrypted.split(":");
    const tamperedTag = Buffer.from(tag, "base64");
    tamperedTag[0] ^= 1;
    assert.throws(
      () =>
        decryptIntegrationSecret(
          `${iv}:${tamperedTag.toString("base64")}:${ciphertext}`
        ),
      /Unsupported state|unable to authenticate/i
    );
  } finally {
    if (previousKey === undefined) delete process.env.INTEGRATION_SECRETS_KEY;
    else process.env.INTEGRATION_SECRETS_KEY = previousKey;
  }
});

test("integration credential encryption rejects missing or malformed keys", () => {
  const previousKey = process.env.INTEGRATION_SECRETS_KEY;
  try {
    delete process.env.INTEGRATION_SECRETS_KEY;
    assert.throws(assertIntegrationEncryptionKey, /64 hexadecimal characters/);
    process.env.INTEGRATION_SECRETS_KEY = "not-a-key";
    assert.throws(assertIntegrationEncryptionKey, /64 hexadecimal characters/);
  } finally {
    if (previousKey === undefined) delete process.env.INTEGRATION_SECRETS_KEY;
    else process.env.INTEGRATION_SECRETS_KEY = previousKey;
  }
});
