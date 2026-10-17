import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyCashfreeSignatureWithSecret } from "../lib/cashfree-webhook-signature";

test("Cashfree webhook verification accepts an authentic signature", () => {
  const timestamp = "1791993600";
  const body = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK" });
  const signature = createHmac("sha256", "test-secret")
    .update(timestamp + body)
    .digest("base64");

  assert.equal(
    verifyCashfreeSignatureWithSecret(body, timestamp, signature, "test-secret"),
    true
  );
  assert.equal(
    verifyCashfreeSignatureWithSecret(`${body} `, timestamp, signature, "test-secret"),
    false
  );
  assert.equal(
    verifyCashfreeSignatureWithSecret(body, timestamp, "invalid", "test-secret"),
    false
  );
});
