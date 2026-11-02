import assert from "node:assert/strict";
import test from "node:test";
import { getWhatsAppChatUrl } from "../lib/whatsapp-number";

test("WhatsApp chat URLs use digits only and preserve the country code", () => {
  assert.equal(
    getWhatsAppChatUrl("+91 (98765) 43210"),
    "https://wa.me/919876543210"
  );
});

test("WhatsApp chat URLs reject numbers outside the supported digit length", () => {
  assert.equal(getWhatsAppChatUrl("1234567"), null);
  assert.equal(getWhatsAppChatUrl("1234567890123456"), null);
  assert.equal(getWhatsAppChatUrl(""), null);
});
