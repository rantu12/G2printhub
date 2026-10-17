"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import WishlistButton from "@/app/components/wishlist-button";

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  productCount: number;
};

type Product = {
id: string;
name: string;
title: string | null;
slug: string;
description: string | null;
image: string | null;
price: string;
discountPrice: string | null;
stock: number;
featured: boolean;
category: Pick<Category, "id" | "name" | "slug">;
};

type HomepageSettings = {
  homepageEyebrow: string;
  homepageTitle: string;
  homepageDescription: string;
  homepageSaleEnabled: boolean;
  homepageOffer: string;
  homepageImage: string;
};

const defaultHomepageSettings: HomepageSettings = {
  homepageEyebrow: "THE PRINT SHOP",
  homepageTitle: "Find your next favourite print.",
  homepageDescription:
    "Custom cards, T-shirts, mugs and more. Explore our collection and make every print personal.",
  homepageSaleEnabled: true,
  homepageOffer: "",
  homepageImage: "",
};

export default function ProductsPage() {
const [products, setProducts] = useState<Product[]>([]);
const [categories, setCategories] = useState<Category[]>([]);
const [homepageSettings, setHomepageSettings] = useState(defaultHomepageSettings);
const [search, setSearch] = useState("");
const [category, setCategory] = useState("all");
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");

useEffect(() => {
async function loadCategories() {
  try {
    const response = await fetch("/api/categories", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Categories could not be loaded.");
    }

    setCategories(data.categories);
  } catch (err) {
    console.error("Store categories load error:", err);
  }
}

async function loadHomepageSettings() {
  try {
    const response = await fetch("/api/homepage-settings", {
      cache: "no-store",
    });
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Homepage settings could not be loaded.");
    }

    setHomepageSettings(data.settings);
  } catch (err) {
    console.error("Homepage settings load error:", err);
  }
}

async function loadProducts() {
try {
const response = await fetch("/api/products", {
cache: "no-store",
});
const data = await response.json();


    if (!response.ok) {
      throw new Error(data.message || "Products could not be loaded.");
    }

    setProducts(data.products || []);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Something went wrong."
    );
  } finally {
    setLoading(false);
  }
}

loadCategories();
loadHomepageSettings();
loadProducts();


}, []);

const filteredProducts = useMemo(() => {
const query = search.trim().toLowerCase();
return products.filter((product) => {
  const matchesSearch =
    !query ||
    product.name.toLowerCase().includes(query) ||
    (product.title || "").toLowerCase().includes(query) ||
    (product.description || "").toLowerCase().includes(query) ||
    product.category?.name.toLowerCase().includes(query);

  const matchesCategory =
    category === "all" ||
    product.category?.slug === category;

  return matchesSearch && matchesCategory;
});


}, [products, search, category]);

function formatPrice(value: string | null) {
const amount = Number(value);
return `₹${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
}

return ( <main className="shop-page">
    <div className="shop-container">


    <header
      className={`shop-hero${homepageSettings.homepageImage ? " has-background-image" : ""}`}
      style={{
        backgroundImage: homepageSettings.homepageImage
          ? `linear-gradient(90deg, rgb(15 23 42 / 94%), rgb(15 23 42 / 52%)), url("${homepageSettings.homepageImage}")`
          : undefined,
      }}
    >
      <div>
        {homepageSettings.homepageSaleEnabled && homepageSettings.homepageOffer && (
          <span className="shop-offer">
            <strong>SALE</strong>
            {homepageSettings.homepageOffer.trim().toLowerCase() !== "sale" && (
              <span>{homepageSettings.homepageOffer}</span>
            )}
          </span>
        )}
        {homepageSettings.homepageEyebrow && (
          <span className="shop-eyebrow">{homepageSettings.homepageEyebrow}</span>
        )}
        <h1>{homepageSettings.homepageTitle}</h1>
        {homepageSettings.homepageDescription && (
          <p>{homepageSettings.homepageDescription}</p>
        )}
      </div>
    </header>

    {categories.length > 0 && (
      <section className="shop-category-box" aria-label="Explore categories">
        <div className="shop-category-box-header">
          <div>
            <span className="shop-eyebrow">SHOP BY CATEGORY</span>
            <h2>Explore all categories</h2>
          </div>

          <Link href="/products" className="shop-category-box-link">
            View all products
          </Link>
        </div>

        <div className="shop-category-grid">
          {categories.map((item) => {
            return (
            <article key={item.id}>
              <Link
                href={`/products?category=${encodeURIComponent(item.slug)}`}
                className="shop-category-card"
              >
                <span className="shop-category-card-image">
                  {item.image ? (
                    <img src={item.image} alt="" />
                  ) : (
                    <span className="shop-category-card-icon" aria-hidden="true">▣</span>
                  )}
                </span>
                <span className="shop-category-card-copy">
                  <strong>{item.name}</strong>
                  <small>{item.productCount} product{item.productCount === 1 ? "" : "s"}</small>
                </span>
              </Link>
            </article>
            );
          })}
        </div>
      </section>
    )}

    <section className="shop-toolbar">
      <input
        aria-label="Search products"
        type="search"
        placeholder="Search products..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <select
        aria-label="Filter by category"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      >
        <option value="all">All categories</option>
        {categories.map((item) => (
          <option key={item.id} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>

      <span className="shop-result-count">
        {filteredProducts.length} products
      </span>
    </section>

    {loading ? (
      <div className="shop-message">Loading products...</div>
    ) : error ? (
      <div className="shop-message shop-error">
        {error}
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    ) : filteredProducts.length === 0 ? (
      <div className="shop-message">
        <h2>No products found</h2>
        <p>Try another search or select a different category.</p>
        <button
          onClick={() => {
            setSearch("");
            setCategory("all");
          }}
        >
          Clear filters
        </button>
      </div>
    ) : (
      <section className="shop-grid">
        {filteredProducts.map((product) => (
          <article className="shop-product-card" key={product.id}>
            <div
              className={`shop-product-visual${
                product.featured && product.discountPrice
                  ? " has-featured-discount"
                  : ""
              }`}
            >
              <Link
                href={`/products/${product.slug}`}
                className="shop-product-image"
              >
              {product.image ? (
                <img src={product.image} alt={product.name} />
              ) : (
                <div className="shop-product-placeholder">
                  <span>✳</span>
                  <small>PrintHub</small>
                </div>
              )}

              {product.featured && (
                <span className="shop-featured-badge">Featured</span>
              )}

              {product.discountPrice && (
                <span className="shop-discount-badge">Special price</span>
              )}
              </Link>
              <WishlistButton
                product={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  image: product.image,
                  price: product.price,
                  discountPrice: product.discountPrice,
                  categoryName: product.category?.name,
                }}
              />
            </div>

            <div className="shop-product-info">
              <span className="shop-category-name">
                {product.category?.name || "Print products"}
              </span>

              <Link
                href={`/products/${product.slug}`}
                className="shop-product-title"
              >
                {product.name}
              </Link>

              {product.title && (
                <p className="shop-product-subtitle">{product.title}</p>
              )}

              <div className="shop-price-row">
                <strong>
                  {formatPrice(product.discountPrice ?? product.price)}
                </strong>

                {product.discountPrice && (
                  <del>{formatPrice(product.price)}</del>
                )}
              </div>

              <Link
                href={`/products/${product.slug}`}
                className="shop-view-button"
              >
                View Product <span>→</span>
              </Link>
            </div>
          </article>
        ))}
      </section>
    )}

  </div>
</main>


);
}
