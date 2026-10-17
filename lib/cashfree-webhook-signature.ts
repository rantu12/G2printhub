import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyCashfreeSignatureWithSecret(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  clientSecret: string
): boolean {
  if (
    !timestamp ||
    !/^\d+$/.test(timestamp) ||
    !signature ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)
  ) {
    return false;
  }

  const expected = createHmac("sha256", clientSecret)
    .update(timestamp + rawBody)
    .digest();
  const received = Buffer.from(signature, "base64");
  return (
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}
