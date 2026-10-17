import assert from "node:assert/strict";
import test from "node:test";
import {
  isCodAvailableForAmount,
  isCodAvailableForProducts,
} from "../lib/cod-availability";

test("COD requires the store setting and every cart product to allow COD", () => {
  assert.equal(isCodAvailableForProducts(true, [true, true]), true);
  assert.equal(isCodAvailableForProducts(false, [true, true]), false);
  assert.equal(isCodAvailableForProducts(true, [true, false]), false);
  assert.equal(isCodAvailableForProducts(true, [false]), false);
});

test("COD is unavailable if a requested cart product was not found", () => {
  assert.equal(isCodAvailableForProducts(true, [true], 2), false);
});

test("COD amount limits include both boundaries and allow an open maximum", () => {
  assert.equal(isCodAvailableForAmount(1000, 1000, 5000), true);
  assert.equal(isCodAvailableForAmount(5000, 1000, 5000), true);
  assert.equal(isCodAvailableForAmount(999, 1000, 5000), false);
  assert.equal(isCodAvailableForAmount(5001, 1000, 5000), false);
  assert.equal(isCodAvailableForAmount(1000, 1000, null), true);
});

test("COD amount limits reject invalid cent values", () => {
  assert.equal(isCodAvailableForAmount(Number.NaN, 0, null), false);
  assert.equal(isCodAvailableForAmount(100.5, 0, null), false);
  assert.equal(isCodAvailableForAmount(1, Number.NaN, null), false);
});
