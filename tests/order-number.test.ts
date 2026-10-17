import assert from "node:assert/strict";
import test from "node:test";
import { formatOrderNumber } from "../lib/order-number";

test("order numbers start with G2-PH and pad the sequence to four digits", () => {
  assert.equal(formatOrderNumber("1"), "G2-PH-0001");
  assert.equal(formatOrderNumber("42"), "G2-PH-0042");
  assert.equal(formatOrderNumber("10000"), "G2-PH-10000");
});

test("order number formatting rejects invalid sequence values", () => {
  for (const value of ["0", "-1", "1.5", "abc"]) {
    assert.throws(() => formatOrderNumber(value));
  }
});
