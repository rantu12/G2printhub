import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCustomPrintCategory,
  parseCustomPrintDesignConfiguration,
  parseCustomPrintProduct,
} from "../lib/custom-print-validation";
import {
  validateCustomPrintArtworkFile,
  validateCustomPrintModelFile,
} from "../lib/custom-print-artwork-validation";

test("Custom Print category validation accepts valid records and rejects invalid slugs", () => {
  const valid = parseCustomPrintCategory({
    name: "T-Shirts",
    slug: "t-shirts",
    active: true,
    sortOrder: 1,
  });
  assert.equal(valid.success, true);

  const invalid = parseCustomPrintCategory({
    name: "T-Shirts",
    slug: "T Shirts",
  });
  assert.equal(invalid.success, false);
});

test("Custom Print product validation checks options, print areas, and price limits", () => {
  const valid = parseCustomPrintProduct({
    name: "Custom Mug",
    slug: "custom-mug",
    sku: "MUG-1",
    categoryId: "category-id",
    price: 250,
    salePrice: 200,
    options: [
      {
        name: "finish",
        label: "Finish",
        required: true,
        choices: [
          { label: "Gloss", value: "gloss", priceAdjustment: 10 },
        ],
      },
    ],
    printAreas: [
      {
        name: "Front",
        width: 8,
        height: 9,
        unit: "cm",
        additionalCharge: 0,
      },
    ],
  });
  assert.equal(valid.success, true);

  const invalidOption = parseCustomPrintProduct({
    name: "Custom Mug",
    slug: "custom-mug",
    sku: "MUG-1",
    categoryId: "category-id",
    price: 250,
    options: [{ name: "finish", label: "Finish", choices: [] }],
  });
  assert.equal(invalidOption.success, false);

  const invalidPrice = parseCustomPrintProduct({
    name: "Custom Mug",
    slug: "custom-mug",
    sku: "MUG-1",
    categoryId: "category-id",
    price: 200,
    salePrice: 250,
  });
  assert.equal(invalidPrice.success, false);
});

test("Custom Print design validation bounds positions and text configuration", () => {
  const valid = parseCustomPrintDesignConfiguration({
    printArea: {
      id: "area-1",
      name: "Front",
      surface: "front",
      shape: "circle",
    },
    elements: [
      {
        type: "text",
        text: "Hello",
        x: 50,
        y: 40,
        scale: 1,
        rotation: 0,
        color: "#112233",
        fontSize: 24,
      },
      {
        type: "image",
        x: 50,
        y: 50,
        scale: 1,
        rotation: 180,
      },
    ],
  });
  assert.equal(valid.success, true);
  if (
    valid.success &&
    typeof valid.value === "object" &&
    valid.value !== null &&
    !Array.isArray(valid.value) &&
    "printArea" in valid.value
  ) {
    assert.deepEqual(valid.value.printArea, {
      id: "area-1",
      name: "Front",
      surface: "front",
      shape: "circle",
    });
  } else {
    assert.fail("Expected print area configuration to be present.");
  }

  const invalid = parseCustomPrintDesignConfiguration({
    elements: [{ type: "image", x: 101, y: 50, scale: 1, rotation: 0 }],
  });
  assert.equal(invalid.success, false);

  const invalidArea = parseCustomPrintDesignConfiguration({
    elements: [],
    printArea: { id: "", name: "Front", surface: "front" },
  });
  assert.equal(invalidArea.success, false);
});

test("Custom Print artwork validation enforces type, file signature, and size", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7");
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const glb = new Uint8Array([
    0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00,
    0x0c, 0x00, 0x00, 0x00,
  ]);
  assert.deepEqual(
    validateCustomPrintArtworkFile(
      "application/pdf",
      pdf.byteLength,
      pdf,
      1024,
      ["application/pdf"]
    ),
    { success: true, extension: "pdf" }
  );
  assert.deepEqual(
    validateCustomPrintArtworkFile(
      "image/jpeg",
      jpeg.byteLength,
      jpeg,
      1024,
      ["image/jpeg"]
    ),
    { success: true, extension: "jpg" }
  );

  assert.equal(
    validateCustomPrintArtworkFile(
      "image/jpeg",
      pdf.byteLength,
      pdf,
      1024,
      ["image/jpeg"]
    ).success,
    false
  );
  assert.equal(
    validateCustomPrintArtworkFile(
      "image/png",
      png.byteLength,
      png,
      1024,
      ["image/png"]
    ).success,
    true
  );
  assert.equal(
    parseCustomPrintProduct({
      name: "Round Mug",
      slug: "round-mug",
      sku: "MUG-2",
      categoryId: "category-id",
      price: 250,
      salePrice: null,
      customizationSettings: {
        modelUrl: null,
        printAreas: [
          {
            id: "round-front",
            name: "Round Front",
            surface: "front",
            shape: "circle",
            width: 200,
            height: 200,
            x: 400,
            y: 300,
            rotation: 0,
            allowText: true,
            allowImages: true,
            allowStickers: true,
          },
        ],
      },
    }).success,
    true
  );
  assert.equal(
    parseCustomPrintProduct({
      name: "Round Mug",
      slug: "round-mug",
      sku: "MUG-2",
      categoryId: "category-id",
      price: 250,
      salePrice: null,
      customizationSettings: {
        printAreas: [
          {
            id: "round-front",
            name: "Round Front",
            surface: "front",
            shape: "circle",
            width: 200,
            height: 201,
            x: 400,
            y: 300,
            rotation: 0,
            allowText: true,
            allowImages: true,
            allowStickers: true,
          },
        ],
      },
    }).success,
    false
  );
  assert.equal(
    validateCustomPrintModelFile(
      "model/gltf-binary",
      glb.byteLength,
      glb
    ).success,
    true
  );
  const invalidGlb = glb.slice();
  invalidGlb[8] = 11;
  assert.equal(
    validateCustomPrintModelFile(
      "model/gltf-binary",
      invalidGlb.byteLength,
      invalidGlb
    ).success,
    false
  );
  assert.equal(
    validateCustomPrintArtworkFile(
      "application/pdf",
      pdf.byteLength,
      pdf,
      2,
      ["application/pdf"]
    ).success,
    false
  );
  assert.equal(
    validateCustomPrintArtworkFile(
      "image/png",
      pdf.byteLength,
      pdf,
      1024,
      ["image/png"]
    ).success,
    false
  );
});
