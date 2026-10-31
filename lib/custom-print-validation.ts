import type { Prisma } from "@/app/generated/prisma/client";

type JsonValue = Prisma.InputJsonValue;
type Validation<T> =
  | { success: true; value: T }
  | { success: false; message: string };

export type CustomPrintCategoryInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  active?: boolean;
  sortOrder?: number;
};

export type CustomPrintProductInput = {
  name?: string;
  slug?: string;
  sku?: string;
  description?: string | null;
  image?: string | null;
  images?: string[];
  colors?: string[];
  sizes?: string[];
  options?: JsonValue | null;
  printAreas?: JsonValue | null;
  customizationSettings?: JsonValue | null;
  price?: number;
  salePrice?: number | null;
  stock?: number;
  availability?: boolean;
  active?: boolean;
  sortOrder?: number;
  categoryId?: string;
  angleImages?: { url: string; label: string | null; sortOrder: number }[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail<T>(message: string): Validation<T> {
  return { success: false, message };
}


function validImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) {
    return false;
  }

  // Allow safe local image paths.
  if (value.startsWith("/uploads/")) {
    if (
      value.startsWith("//") ||
      value.includes("\\") ||
      /[\u0000-\u001F]/.test(value) ||
      value.split("/").some((part) => part === "." || part === "..")
    ) {
      return false;
    }

    return true;
  }

  // Keep support for HTTP and HTTPS image URLs.
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}


function parseStringArray(
  value: unknown,
  label: string,
  maximum: number,
  itemMaximum = 100
): Validation<string[]> {
  if (
    !Array.isArray(value) ||
    value.length > maximum ||
    value.some(
      (item) =>
        typeof item !== "string" ||
        !item.trim() ||
        item.length > itemMaximum
    )
  ) {
    return fail(`Invalid ${label}.`);
  }
  const normalized = value.map((item) => (item as string).trim());
  if (new Set(normalized).size !== normalized.length) {
    return fail(`${label} must not contain duplicates.`);
  }
  return { success: true, value: normalized };
}

const categoryFields = new Set([
  "name",
  "slug",
  "description",
  "image",
  "active",
  "sortOrder",
]);

export function parseCustomPrintCategory(
  input: unknown,
  partial = false
): Validation<CustomPrintCategoryInput> {
  if (!isRecord(input)) return fail("Provide a valid category object.");
  if (Object.keys(input).some((key) => !categoryFields.has(key))) {
    return fail("The category contains an unsupported field.");
  }

  const result: CustomPrintCategoryInput = {};
  if (!partial || "name" in input) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 120) {
      return fail("Category name is required and must be at most 120 characters.");
    }
    result.name = input.name.trim();
  }
  if (!partial || "slug" in input) {
    if (
      typeof input.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug.trim()) ||
      input.slug.trim().length > 160
    ) {
      return fail("Category slug must use lowercase letters, numbers, and hyphens.");
    }
    result.slug = input.slug.trim();
  }
  if (!partial || "description" in input) {
    if (
      input.description !== undefined &&
      input.description !== null &&
      (typeof input.description !== "string" || input.description.length > 4000)
    ) {
      return fail("Category description must be at most 4000 characters.");
    }
    result.description =
      typeof input.description === "string" && input.description.trim()
        ? input.description.trim()
        : null;
  }
  if (!partial || "image" in input) {
    if (
      input.image !== undefined &&
      input.image !== null &&
      !validImageUrl(input.image)
    ) {
      return fail("Category image must be a valid HTTP or HTTPS URL.");
    }
    result.image =
      typeof input.image === "string" && input.image ? input.image : null;
  }
  if (!partial || "active" in input) {
    if (input.active !== undefined && typeof input.active !== "boolean") {
      return fail("Category active status must be a boolean.");
    }
    result.active = input.active === undefined ? true : input.active;
  }
  if (!partial || "sortOrder" in input) {
    const order = input.sortOrder === undefined ? 0 : input.sortOrder;
    if (!Number.isInteger(order) || (order as number) < 0 || (order as number) > 100000) {
      return fail("Category sort order must be a non-negative integer.");
    }
    result.sortOrder = order as number;
  }
  return { success: true, value: result };
}

function parseOptions(value: unknown): Validation<JsonValue> {
  if (!Array.isArray(value) || value.length > 30) {
    return fail("Options must be an array of up to 30 entries.");
  }
  const options: { name: string; label: string; required: boolean; choices: { label: string; value: string; priceAdjustment: number }[] }[] = [];
  const names = new Set<string>();
  for (const option of value) {
    if (
      !isRecord(option) ||
      Object.keys(option).some((key) => !["name", "label", "required", "choices"].includes(key)) ||
      typeof option.name !== "string" ||
      !/^[a-zA-Z0-9_-]{1,60}$/.test(option.name) ||
      names.has(option.name) ||
      typeof option.label !== "string" ||
      !option.label.trim() ||
      option.label.length > 100 ||
      (option.required !== undefined && typeof option.required !== "boolean") ||
      !Array.isArray(option.choices) ||
      option.choices.length === 0 ||
      option.choices.length > 50
    ) {
      return fail("Invalid product option configuration.");
    }
    names.add(option.name);
    const choiceValues = new Set<string>();
    const choices: { label: string; value: string; priceAdjustment: number }[] = [];
    for (const choice of option.choices) {
      if (
        !isRecord(choice) ||
        Object.keys(choice).some((key) => !["label", "value", "priceAdjustment"].includes(key)) ||
        typeof choice.label !== "string" ||
        !choice.label.trim() ||
        choice.label.length > 100 ||
        typeof choice.value !== "string" ||
        !/^[a-zA-Z0-9 _-]{1,100}$/.test(choice.value) ||
        choiceValues.has(choice.value) ||
        (choice.priceAdjustment !== undefined &&
          (typeof choice.priceAdjustment !== "number" ||
            !Number.isFinite(choice.priceAdjustment) ||
            choice.priceAdjustment < 0 ||
            choice.priceAdjustment > 100000))
      ) {
        return fail("Invalid product option choice.");
      }
      choiceValues.add(choice.value);
      choices.push({
        label: choice.label.trim(),
        value: choice.value,
        priceAdjustment: choice.priceAdjustment ?? 0,
      });
    }
    options.push({
      name: option.name,
      label: option.label.trim(),
      required: option.required ?? false,
      choices,
    });
  }
  return { success: true, value: options as JsonValue };
}

function parsePrintAreas(value: unknown): Validation<JsonValue> {
  if (!Array.isArray(value) || value.length > 20) {
    return fail("Print areas must be an array of up to 20 entries.");
  }
  const areas: { name: string; width: number; height: number; unit: string; additionalCharge: number }[] = [];
  const names = new Set<string>();
  for (const area of value) {
    if (
      !isRecord(area) ||
      Object.keys(area).some((key) => !["name", "width", "height", "unit", "additionalCharge"].includes(key)) ||
      typeof area.name !== "string" ||
      !area.name.trim() ||
      area.name.length > 100 ||
      names.has(area.name) ||
      typeof area.width !== "number" ||
      !Number.isFinite(area.width) ||
      area.width <= 0 ||
      area.width > 10000 ||
      typeof area.height !== "number" ||
      !Number.isFinite(area.height) ||
      area.height <= 0 ||
      area.height > 10000 ||
      (area.unit !== "mm" && area.unit !== "cm" && area.unit !== "in") ||
      (area.additionalCharge !== undefined &&
        (typeof area.additionalCharge !== "number" ||
          !Number.isFinite(area.additionalCharge) ||
          area.additionalCharge < 0 ||
          area.additionalCharge > 100000))
    ) {
      return fail("Invalid print area configuration.");
    }
    names.add(area.name);
    areas.push({
      name: area.name.trim(),
      width: area.width,
      height: area.height,
      unit: area.unit,
      additionalCharge: area.additionalCharge ?? 0,
    });
  }
  return { success: true, value: areas as JsonValue };
}


function validModelUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) {
    return false;
  }

  // Prefer a locally uploaded GLB model.
  if (value.startsWith("/uploads/")) {
    return (
      !value.startsWith("//") &&
      !value.includes("\\") &&
      !/[\u0000-\u001F]/.test(value) &&
      !value.split("/").some(
        (part) => part === "." || part === ".."
      ) &&
      /\.glb$/i.test(value.split("?")[0])
    );
  }

  // Permit HTTPS-hosted GLB models only.
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      /\.glb$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function parseCustomizationSettings(
  value: unknown
): Validation<JsonValue> {
  if (!isRecord(value)) {
    return fail("Customization settings must be an object.");
  }

  const keys = [
    "allowArtwork",
    "allowText",
    "maxArtworkFileSize",
    "acceptedArtworkTypes",
    "maxTextLength",
    "mockupImages",
    "mockup360",
    "modelUrl",
    "printAreas",
  ];

  if (Object.keys(value).some((key) => !keys.includes(key))) {
    return fail("Customization settings contain an unsupported field.");
  }

  if (
    (value.allowArtwork !== undefined &&
      typeof value.allowArtwork !== "boolean") ||
    (value.allowText !== undefined &&
      typeof value.allowText !== "boolean") ||
    (value.maxArtworkFileSize !== undefined &&
      (!Number.isInteger(value.maxArtworkFileSize) ||
        (value.maxArtworkFileSize as number) < 1 ||
        (value.maxArtworkFileSize as number) > 10 * 1024 * 1024)) ||
    (value.maxTextLength !== undefined &&
      (!Number.isInteger(value.maxTextLength) ||
        (value.maxTextLength as number) < 1 ||
        (value.maxTextLength as number) > 1000))
  ) {
    return fail("Invalid customization settings.");
  }

  let modelUrl: string | null | undefined;
  if ("modelUrl" in value) {
    if (value.modelUrl !== null && !validModelUrl(value.modelUrl)) {
      return fail("Invalid Custom Print model URL.");
    }
    modelUrl = value.modelUrl;
  }

  let configuredPrintAreas:
    | {
        id: string;
        name: string;
        surface: string;
        shape: "rectangle" | "circle";
        width: number;
        height: number;
        x: number;
        y: number;
        rotation: number;
        allowText: boolean;
        allowImages: boolean;
        allowStickers: boolean;
      }[]
    | undefined;

  if ("printAreas" in value) {
    if (!Array.isArray(value.printAreas) || value.printAreas.length > 20) {
      return fail("Custom Print areas must be an array of up to 20 entries.");
    }

    configuredPrintAreas = [];
    for (const candidate of value.printAreas) {
      if (
        !isRecord(candidate) ||
        Object.keys(candidate).some(
          (key) =>
            ![
              "id",
              "name",
              "surface",
              "shape",
              "width",
              "height",
              "x",
              "y",
              "rotation",
              "allowText",
              "allowImages",
              "allowStickers",
            ].includes(key)
        ) ||
        typeof candidate.id !== "string" ||
        !candidate.id.trim() ||
        candidate.id.length > 100 ||
        typeof candidate.name !== "string" ||
        !candidate.name.trim() ||
        candidate.name.length > 100 ||
        typeof candidate.surface !== "string" ||
        !["front", "back", "left", "right", "top", "custom"].includes(candidate.surface) ||
        (candidate.shape !== undefined &&
          candidate.shape !== "rectangle" &&
          candidate.shape !== "circle") ||
        (candidate.shape === "circle" &&
          candidate.width !== candidate.height) ||
        typeof candidate.width !== "number" ||
        !Number.isFinite(candidate.width) ||
        candidate.width <= 0 ||
        candidate.width > 1000 ||
        typeof candidate.height !== "number" ||
        !Number.isFinite(candidate.height) ||
        candidate.height <= 0 ||
        candidate.height > 1000 ||
        typeof candidate.x !== "number" ||
        !Number.isFinite(candidate.x) ||
        candidate.x < 0 ||
        candidate.x + candidate.width > 1000 ||
        typeof candidate.y !== "number" ||
        !Number.isFinite(candidate.y) ||
        candidate.y < 0 ||
        candidate.y + candidate.height > 1000 ||
        typeof candidate.rotation !== "number" ||
        !Number.isFinite(candidate.rotation) ||
        candidate.rotation < -180 ||
        candidate.rotation > 180 ||
        typeof candidate.allowText !== "boolean" ||
        typeof candidate.allowImages !== "boolean" ||
        typeof candidate.allowStickers !== "boolean"
      ) {
        return fail("Invalid Custom Print area configuration.");
      }

      configuredPrintAreas.push({
        id: candidate.id.trim(),
        name: candidate.name.trim(),
        surface: candidate.surface,
        shape: candidate.shape === "circle" ? "circle" : "rectangle",
        width: candidate.width,
        height: candidate.height,
        x: candidate.x,
        y: candidate.y,
        rotation: candidate.rotation,
        allowText: candidate.allowText,
        allowImages: candidate.allowImages,
        allowStickers: candidate.allowStickers,
      });
    }
  }

  const fileTypes =
    value.acceptedArtworkTypes ?? [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];

  if (
    !Array.isArray(fileTypes) ||
    fileTypes.length === 0 ||
    fileTypes.some(
      (type) =>
        type !== "image/jpeg" &&
        type !== "image/png" &&
        type !== "application/pdf"
    )
  ) {
    return fail("Artwork types may only include JPG, PNG, and PDF.");
  }

  let mockupImages: Record<string, string> | undefined;

  if (value.mockupImages !== undefined) {
    if (
      !isRecord(value.mockupImages) ||
      Object.keys(value.mockupImages).some(
        (key) => !["front", "back", "side"].includes(key)
      )
    ) {
      return fail("Invalid mockup images configuration.");
    }

    mockupImages = {};

    for (const side of ["front", "back", "side"] as const) {
      const image = value.mockupImages[side];

      if (image !== undefined && image !== "") {
        if (!validImageUrl(image)) {
          return fail(`Invalid ${side} mockup image URL.`);
        }

        mockupImages[side] = image;
      }
    }
  }

  let mockup360:
    | {
        enabled: boolean;
        modelUrl: string;
        surfaceMeshName: string;
      }
    | undefined;

  if (value.mockup360 !== undefined) {
    if (
      !isRecord(value.mockup360) ||
      Object.keys(value.mockup360).some(
        (key) =>
          !["enabled", "modelUrl", "surfaceMeshName"].includes(key)
      )
    ) {
      return fail("Invalid 3D mockup configuration.");
    }

    const config = value.mockup360;

    if (
      typeof config.enabled !== "boolean" ||
      typeof config.modelUrl !== "string" ||
      !validModelUrl(config.modelUrl) ||
      typeof config.surfaceMeshName !== "string" ||
      !config.surfaceMeshName.trim() ||
      config.surfaceMeshName.length > 120
    ) {
      return fail("Invalid 3D model URL or surface mesh name.");
    }

    mockup360 = {
      enabled: config.enabled,
      modelUrl: config.modelUrl,
      surfaceMeshName: config.surfaceMeshName.trim(),
    };
  }

  return {
    success: true,
    value: {
      allowArtwork: value.allowArtwork ?? true,
      allowText: value.allowText ?? true,
      maxArtworkFileSize:
        value.maxArtworkFileSize ?? 10 * 1024 * 1024,
      acceptedArtworkTypes: [...new Set(fileTypes)],
      maxTextLength: value.maxTextLength ?? 200,
      ...(mockupImages !== undefined ? { mockupImages } : {}),
      ...(mockup360 !== undefined ? { mockup360 } : {}),
      ...(modelUrl !== undefined ? { modelUrl } : {}),
      ...(configuredPrintAreas !== undefined
        ? { printAreas: configuredPrintAreas }
        : {}),
    } as JsonValue,
  };
}


const productFields = new Set([
  "name",
  "slug",
  "sku",
  "description",
  "image",
  "images",
  "colors",
  "sizes",
  "options",
  "printAreas",
  "customizationSettings",
  "price",
  "salePrice",
  "stock",
  "availability",
  "active",
  "sortOrder",
  "categoryId",
  "angleImages",
]);

export function parseCustomPrintProduct(
  input: unknown,
  partial = false
): Validation<CustomPrintProductInput> {
  if (!isRecord(input)) return fail("Provide a valid product object.");
  if (Object.keys(input).some((key) => !productFields.has(key))) {
    return fail("The product contains an unsupported field.");
  }

  const result: CustomPrintProductInput = {};
  if (!partial || "name" in input) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 160) {
      return fail("Product name is required and must be at most 160 characters.");
    }
    result.name = input.name.trim();
  }
  if (!partial || "slug" in input) {
    if (
      typeof input.slug !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug.trim()) ||
      input.slug.trim().length > 180
    ) {
      return fail("Product slug must use lowercase letters, numbers, and hyphens.");
    }
    result.slug = input.slug.trim();
  }
  if (!partial || "sku" in input) {
    if (
      typeof input.sku !== "string" ||
      !/^[A-Z0-9_-]{1,80}$/.test(input.sku.trim().toUpperCase())
    ) {
      return fail("Product SKU is required and may contain letters, numbers, hyphens, or underscores.");
    }
    result.sku = input.sku.trim().toUpperCase();
  }
  if (!partial || "categoryId" in input) {
    if (typeof input.categoryId !== "string" || !input.categoryId.trim() || input.categoryId.length > 100) {
      return fail("A valid Custom Print category is required.");
    }
    result.categoryId = input.categoryId.trim();
  }
  if (!partial || "description" in input) {
    if (
      input.description !== undefined &&
      input.description !== null &&
      (typeof input.description !== "string" || input.description.length > 10000)
    ) {
      return fail("Product description must be at most 10000 characters.");
    }
    result.description =
      typeof input.description === "string" && input.description.trim()
        ? input.description.trim()
        : null;
  }
  if (!partial || "image" in input) {
    if (input.image !== undefined && input.image !== null && !validImageUrl(input.image)) {
      return fail("Product image must be a valid HTTP or HTTPS URL.");
    }
    result.image = typeof input.image === "string" && input.image ? input.image : null;
  }
  for (const field of ["images", "colors", "sizes"] as const) {
    if (!partial || field in input) {
      const maximum = field === "images" ? 20 : 50;
      const parsed = parseStringArray(input[field] ?? [], field, maximum, field === "images" ? 2048 : 100);
      if (!parsed.success) return parsed;
      if (field === "images" && parsed.value.some((url) => !validImageUrl(url))) {
        return fail("Product images must be valid HTTP or HTTPS URLs.");
      }
      result[field] = parsed.value;
    }
  }
  for (const field of ["price", "salePrice"] as const) {
    if (!partial || field in input) {
      if (field === "salePrice" && (input.salePrice === null || input.salePrice === "")) {
        result.salePrice = null;
        continue;
      }
      const amount = input[field];
      if (
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 99999999 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001
      ) {
        return fail(`Product ${field} must be a valid amount with at most two decimal places.`);
      }
      result[field] = amount;
    }
  }
  if (
    result.salePrice !== undefined &&
    result.salePrice !== null &&
    result.price !== undefined &&
    result.salePrice > result.price
  ) {
    return fail("Sale price cannot exceed the base price.");
  }
  if (!partial && result.price === undefined) return fail("Product price is required.");

  if (!partial || "stock" in input) {
    const stock = input.stock === undefined ? 0 : input.stock;
    if (!Number.isInteger(stock) || (stock as number) < 0 || (stock as number) > 10000000) {
      return fail("Product stock must be a non-negative integer.");
    }
    result.stock = stock as number;
  }
  for (const field of ["availability", "active"] as const) {
    if (!partial || field in input) {
      if (input[field] !== undefined && typeof input[field] !== "boolean") {
        return fail(`Product ${field} must be a boolean.`);
      }
      result[field] = input[field] === undefined ? true : input[field];
    }
  }
  if (!partial || "sortOrder" in input) {
    const order = input.sortOrder === undefined ? 0 : input.sortOrder;
    if (!Number.isInteger(order) || (order as number) < 0 || (order as number) > 100000) {
      return fail("Product sort order must be a non-negative integer.");
    }
    result.sortOrder = order as number;
  }
  for (const field of ["options", "printAreas", "customizationSettings"] as const) {
    if (!partial || field in input) {
      const parser =
        field === "options"
          ? parseOptions
          : field === "printAreas"
            ? parsePrintAreas
            : parseCustomizationSettings;
      const parsed = parser(input[field] ?? (field === "customizationSettings" ? {} : []));
      if (!parsed.success) return parsed;
      result[field] = parsed.value;
    }
  }
  if (!partial || "angleImages" in input) {
    const value = input.angleImages ?? [];
    if (!Array.isArray(value) || value.length > 20) {
      return fail("Angle images must be an array of up to 20 entries.");
    }
    const angleImages: NonNullable<CustomPrintProductInput["angleImages"]> = [];
    for (const item of value) {
      if (
        !isRecord(item) ||
        Object.keys(item).some((key) => !["url", "label", "sortOrder"].includes(key)) ||
        !validImageUrl(item.url) ||
        (item.label !== undefined &&
          item.label !== null &&
          (typeof item.label !== "string" || item.label.length > 100)) ||
        (item.sortOrder !== undefined &&
          (!Number.isInteger(item.sortOrder) ||
            (item.sortOrder as number) < 0 ||
            (item.sortOrder as number) > 100000))
      ) {
        return fail("Invalid product angle image.");
      }
      angleImages.push({
        url: item.url,
        label: typeof item.label === "string" && item.label ? item.label.trim() : null,
        sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
      });
    }
    result.angleImages = angleImages;
  }
  return { success: true, value: result };
}

export function parseCustomPrintDesignConfiguration(
  input: unknown
): Validation<JsonValue> {
  if (
    !isRecord(input) ||
    Object.keys(input).some((key) => !["elements", "printArea"].includes(key))
  ) {
    return fail("Design configuration must contain an elements array.");
  }
  if (!Array.isArray(input.elements) || input.elements.length > 20) {
    return fail("Design configuration may contain up to 20 elements.");
  }
  const elements: Record<string, string | number>[] = [];
  for (const element of input.elements) {
    if (!isRecord(element)) return fail("Invalid design element.");
    const common = ["type", "x", "y", "scale", "rotation"];
    const isText = element.type === "text";
    const allowed = isText
      ? [...common, "text", "color", "fontSize"]
      : common;
    if (
      (element.type !== "image" && !isText) ||
      Object.keys(element).some((key) => !allowed.includes(key)) ||
      typeof element.x !== "number" ||
      !Number.isFinite(element.x) ||
      element.x < 0 ||
      element.x > 100 ||
      typeof element.y !== "number" ||
      !Number.isFinite(element.y) ||
      element.y < 0 ||
      element.y > 100 ||
      typeof element.scale !== "number" ||
      !Number.isFinite(element.scale) ||
      element.scale < 0.05 ||
      element.scale > 10 ||
      typeof element.rotation !== "number" ||
      !Number.isFinite(element.rotation) ||
      element.rotation < -360 ||
      element.rotation > 360 ||
      (isText &&
        (typeof element.text !== "string" ||
          !element.text.trim() ||
          element.text.length > 1000 ||
          typeof element.color !== "string" ||
          !/^#[0-9a-fA-F]{6}$/.test(element.color) ||
          typeof element.fontSize !== "number" ||
          !Number.isInteger(element.fontSize) ||
          element.fontSize < 8 ||
          element.fontSize > 200))
    ) {
      return fail("Invalid design element values.");
    }
    elements.push(
      isText
        ? {
            type: "text",
            x: element.x,
            y: element.y,
            scale: element.scale,
            rotation: element.rotation,
            text: element.text as string,
            color: element.color as string,
            fontSize: element.fontSize as number,
          }
        : {
            type: "image",
            x: element.x,
            y: element.y,
            scale: element.scale,
            rotation: element.rotation,
          }
    );
  }
  let printArea:
    | {
        id: string;
        name: string;
        surface: string;
        shape: "rectangle" | "circle";
      }
    | undefined;
  if (input.printArea !== undefined) {
    if (
      !isRecord(input.printArea) ||
      Object.keys(input.printArea).some(
        (key) => !["id", "name", "surface", "shape"].includes(key)
      ) ||
      typeof input.printArea.id !== "string" ||
      !input.printArea.id.trim() ||
      input.printArea.id.length > 100 ||
      typeof input.printArea.name !== "string" ||
      !input.printArea.name.trim() ||
      input.printArea.name.length > 100 ||
      typeof input.printArea.surface !== "string" ||
      !["front", "back", "left", "right", "top", "custom"].includes(
        input.printArea.surface
      ) ||
      (input.printArea.shape !== undefined &&
        input.printArea.shape !== "rectangle" &&
        input.printArea.shape !== "circle")
    ) {
      return fail("Invalid design print area.");
    }
    printArea = {
      id: input.printArea.id,
      name: input.printArea.name.trim(),
      surface: input.printArea.surface,
      shape:
        input.printArea.shape === "circle" ? "circle" : "rectangle",
    };
  }

  return {
    success: true,
    value: { elements, ...(printArea ? { printArea } : {}) } as JsonValue,
  };
}
