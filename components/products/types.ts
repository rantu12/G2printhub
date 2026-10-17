export type ProductCategory = {
  id: string;
  name: string;
  slug: string;
};

export type CatalogProduct = {
  id: string;
  name: string;
  title: string | null;
  slug: string;
  description: string | null;
  image: string | null;
  images: string[];
  colors: string[];
  sizes: string[];
  price: string;
  discountPrice: string | null;
  stock: number;
  availability: boolean;
  featured: boolean;
  customerArtworkEnabled: boolean;
  rating: number | null;
  reviewCount: number;
  createdAt: string;
  category: ProductCategory;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function isProductCategory(value: unknown): value is ProductCategory {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.slug === "string"
  );
}

export function isCatalogProduct(value: unknown): value is CatalogProduct {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (typeof value.title === "string" || value.title === null) &&
    typeof value.slug === "string" &&
    (typeof value.description === "string" || value.description === null) &&
    (typeof value.image === "string" || value.image === null) &&
    Array.isArray(value.images) &&
    value.images.every((image) => typeof image === "string") &&
    Array.isArray(value.colors) &&
    value.colors.every((color) => typeof color === "string") &&
    Array.isArray(value.sizes) &&
    value.sizes.every((size) => typeof size === "string") &&
    typeof value.price === "string" &&
    (typeof value.discountPrice === "string" ||
      value.discountPrice === null) &&
    typeof value.stock === "number" &&
    typeof value.availability === "boolean" &&
    typeof value.featured === "boolean" &&
    typeof value.customerArtworkEnabled === "boolean" &&
    (typeof value.rating === "number" || value.rating === null) &&
    typeof value.reviewCount === "number" &&
    typeof value.createdAt === "string" &&
    isProductCategory(value.category)
  );
}

export const PRODUCT_COLORS = [
  { name: "Black", value: "#171717" },
  { name: "White", value: "#f8fafc" },
  { name: "Red", value: "#dc2626" },
  { name: "Blue", value: "#2563eb" },
  { name: "Pink", value: "#ec4899" },
  { name: "Green", value: "#16a34a" },
] as const;

export function formatPrice(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return `₹${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
}

export function getDiscountPercent(product: CatalogProduct) {
  const price = Number(product.price);
  const discounted = Number(product.discountPrice);
  if (
    !product.discountPrice ||
    !Number.isFinite(price) ||
    !Number.isFinite(discounted) ||
    price <= discounted
  ) {
    return 0;
  }
  return Math.round(((price - discounted) / price) * 100);
}

export function getProductColors(product: Pick<CatalogProduct, "colors">) {
  return product.colors.flatMap((name) => {
    const color = PRODUCT_COLORS.find((item) => item.name === name);
    return color ? [color] : [];
  });
}
