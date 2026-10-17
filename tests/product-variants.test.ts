import assert from "node:assert/strict";
import test from "node:test";
import { isProductSize, PRODUCT_SIZES } from "../lib/product-variants";

test("product size validation accepts the supported catalog sizes", () => {
  for (const size of PRODUCT_SIZES) {
    assert.equal(isProductSize(size), true);
  }
});

test("product size validation rejects unsupported values", () => {
  for (const size of ["", "m", "4XL", "One size", null, 42]) {
    assert.equal(isProductSize(size), false);
  }
});
