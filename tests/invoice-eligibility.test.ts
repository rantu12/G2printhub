import assert from "node:assert/strict";
import test from "node:test";
import { isInvoiceDownloadAvailable } from "../lib/invoice-eligibility";

test("invoice download is available for paid orders", () => {
  assert.equal(isInvoiceDownloadAvailable("PAID", "PENDING"), true);
});

test("invoice download is available for delivered COD orders", () => {
  assert.equal(isInvoiceDownloadAvailable("UNPAID", "DELIVERED"), true);
});

test("invoice download is unavailable for unpaid, undelivered orders", () => {
  assert.equal(isInvoiceDownloadAvailable("UNPAID", "SHIPPED"), false);
});
