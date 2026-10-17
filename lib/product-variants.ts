export const PRODUCT_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
] as const;

export function isProductSize(value: unknown): value is (typeof PRODUCT_SIZES)[number] {
  return (
    typeof value === "string" &&
    PRODUCT_SIZES.some((size) => size === value)
  );
}
