"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ProductFilters, {
  type ProductFiltersState,
} from "@/components/products/ProductFilters";
import ProductGrid from "@/components/products/ProductGrid";
import ProductSearch from "@/components/products/ProductSearch";
import {
  getDiscountPercent,
  isCatalogProduct,
  isProductCategory,
  type CatalogProduct,
  type ProductCategory,
} from "@/components/products/types";

type LocalFilters = Omit<ProductFiltersState, "category">;

const initialFilters: LocalFilters = {
  minimumPrice: "",
  maximumPrice: "",
  minimumDiscount: "",
  sort: "featured",
};

export default function ProductsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedCategory = searchParams.get("category") ?? "";
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<LocalFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const loadProducts = useCallback(async (signal: AbortSignal) => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/products", {
        cache: "no-store",
        signal,
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof data === "object" &&
          data !== null &&
          "message" in data &&
          typeof data.message === "string"
            ? data.message
            : "Unable to load products.";
        throw new Error(message);
      }
      if (
        typeof data !== "object" ||
        data === null ||
        !("products" in data) ||
        !("categories" in data) ||
        !Array.isArray(data.products) ||
        !data.products.every(isCatalogProduct) ||
        !Array.isArray(data.categories) ||
        !data.categories.every(isProductCategory)
      ) {
        throw new Error("The product catalog returned an invalid response.");
      }
      setProducts(data.products);
      setCategories(data.categories);
    } catch (loadError) {
      if (signal.aborted) return;
      console.error("Product catalog request failed:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load products."
      );
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadProducts(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadProducts, reloadKey]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const minimumPrice = filters.minimumPrice
      ? Number(filters.minimumPrice)
      : null;
    const maximumPrice = filters.maximumPrice
      ? Number(filters.maximumPrice)
      : null;
    const minimumDiscount = filters.minimumDiscount
      ? Number(filters.minimumDiscount)
      : null;

    const result = products.filter((product) => {
      const currentPrice = Number(product.discountPrice ?? product.price);
      const matchesQuery =
        !query ||
        [
          product.name,
          product.title ?? "",
          product.description ?? "",
          product.category.name,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);

      return (
        matchesQuery &&
        (!selectedCategory || product.category.slug === selectedCategory) &&
        (minimumPrice === null || currentPrice >= minimumPrice) &&
        (maximumPrice === null || currentPrice <= maximumPrice) &&
        (minimumDiscount === null ||
          getDiscountPercent(product) >= minimumDiscount)
      );
    });

    return result.sort((left, right) => {
      switch (filters.sort) {
        case "price-low":
          return Number(left.discountPrice ?? left.price) -
            Number(right.discountPrice ?? right.price);
        case "price-high":
          return Number(right.discountPrice ?? right.price) -
            Number(left.discountPrice ?? left.price);
        case "discount":
          return getDiscountPercent(right) - getDiscountPercent(left);
        case "rating":
          return (right.rating ?? 0) - (left.rating ?? 0);
        case "newest":
          return Date.parse(right.createdAt) - Date.parse(left.createdAt);
        default:
          return Number(right.featured) - Number(left.featured);
      }
    });
  }, [filters, products, search, selectedCategory]);

  function updateFilters(next: ProductFiltersState) {
    setFilters({
      minimumPrice: next.minimumPrice,
      maximumPrice: next.maximumPrice,
      minimumDiscount: next.minimumDiscount,
      sort: next.sort,
    });

    if (next.category !== selectedCategory) {
      const params = new URLSearchParams(searchParams.toString());
      if (next.category) params.set("category", next.category);
      else params.delete("category");
      const query = params.toString();
      router.replace(query ? `/products?${query}` : "/products", {
        scroll: false,
      });
    }
  }

  function resetFilters() {
    setSearch("");
    setFilters(initialFilters);
    router.replace("/products", { scroll: false });
  }

  return (
    <main className="shop-page">
      <section className="shop-hero">
        <div className="shop-container">
          <div className="shop-breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>Products</span>
          </div>
          <h1>Made for your moments</h1>
          <p>
            Discover custom-printed gifts and everyday essentials, made just
            for you.
          </p>
        </div>
      </section>

      <section className="shop-container shop-content">
        <div className="catalog-toolbar">
          <ProductSearch value={search} onChange={setSearch} />
          <ProductFilters
            categories={categories}
            value={{ ...filters, category: selectedCategory }}
            onChange={updateFilters}
          />
        </div>

        {error && (
          <div className="shop-error catalog-error" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <p className="catalog-result-count" aria-live="polite">
            {visibleProducts.length}{" "}
            {visibleProducts.length === 1 ? "product" : "products"}
          </p>
        )}

        {!error && <ProductGrid products={visibleProducts} loading={loading} />}
        {!loading && !error && visibleProducts.length === 0 && (
          <button type="button" className="catalog-reset" onClick={resetFilters}>
            Clear search and filters
          </button>
        )}
      </section>
    </main>
  );
}
