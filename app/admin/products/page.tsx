"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  title: string | null;
  slug: string;
  sku: string;
  description: string | null;
  image: string | null;
  price: string | number;
  discountPrice: string | number | null;
  stock: number;
  availability: boolean;
  status: string;
  featured: boolean;
  category: Category;
  createdAt: string;
};

function formatPrice(value: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "₹0.00";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "₹0.00";
  }

  return `₹${amount.toFixed(2)}`;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/products", {
      method: "GET",
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || "Unable to load products.");
        }
        if (active) setProducts(data.products || []);
      })
      .catch((error: unknown) => {
        console.error("Load products error:", error);
        if (active) {
          setError(
            error instanceof Error ? error.message : "Unable to load products."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesQuery =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.title || "").toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.slug.toLowerCase().includes(query) ||
        product.category?.name
          ?.toLowerCase()
          .includes(query);
      const isActive = product.availability && product.status === "ACTIVE";
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? isActive : !isActive);

      return matchesQuery && matchesStatus;
    });
  }, [products, search, statusFilter]);

  const activeProducts = products.filter(
    (product) => product.availability && product.status === "ACTIVE"
  ).length;
  const lowStockProducts = products.filter(
    (product) => product.stock > 0 && product.stock <= 5
  ).length;
  const outOfStockProducts = products.filter(
    (product) => product.stock <= 0
  ).length;
  const inventoryUnits = products.reduce(
    (total, product) => total + Math.max(0, product.stock),
    0
  );

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(
      `Delete "${product.name}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(product.id);
      setError("");

      const response = await fetch(
        `/api/admin/products/${product.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Unable to delete product."
        );
      }

      setProducts((currentProducts) =>
        currentProducts.filter(
          (item) => item.id !== product.id
        )
      );
    } catch (error) {
      console.error("Delete product error:", error);

      setError(
        error instanceof Error
          ? error.message
          : "Unable to delete product."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="admin-products-page">
      <div className="admin-page-shell">
        {/* HEADER */}
        <header className="admin-page-header">
          <div>
            <div className="admin-breadcrumb">
              <Link href="/admin">Dashboard</Link>
              <span>/</span>
              <span>Products</span>
            </div>

            <h1>Products</h1>

            <p>
              Manage your PrintHub products, pricing, stock and
              availability.
            </p>
          </div>

          <div className="admin-header-actions">
            <Link
              href="/admin"
              className="admin-secondary-button"
            >
              ← Dashboard
            </Link>

            <Link
              href="/admin/products/new"
              className="admin-primary-button"
            >
              + Add Product
            </Link>
          </div>
        </header>

        <section className="admin-product-metrics" aria-label="Product overview">
          <article className="admin-product-metric">
            <span className="admin-product-metric-icon">▣</span>
            <div>
              <span>Catalog products</span>
              <strong>{products.length}</strong>
            </div>
          </article>
          <article className="admin-product-metric">
            <span className="admin-product-metric-icon is-active">✓</span>
            <div>
              <span>Active products</span>
              <strong>{activeProducts}</strong>
            </div>
          </article>
          <article className="admin-product-metric">
            <span className="admin-product-metric-icon is-warning">!</span>
            <div>
              <span>Low / out of stock</span>
              <strong>{lowStockProducts + outOfStockProducts}</strong>
            </div>
          </article>
          <article className="admin-product-metric">
            <span className="admin-product-metric-icon is-inventory">▤</span>
            <div>
              <span>Inventory units</span>
              <strong>{inventoryUnits}</strong>
            </div>
          </article>
        </section>

        {/* SEARCH */}
        <section className="admin-products-toolbar">
          <label className="admin-search-box">
            <span>⌕</span>

            <input
              type="search"
              aria-label="Search products"
              placeholder="Search product, SKU or category..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </label>

          <div className="admin-products-toolbar-controls">
            <label className="admin-products-status-label" htmlFor="product-status-filter">
              Status
            </label>
            <select
              id="product-status-filter"
              className="admin-products-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All products</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <span className="admin-products-count" aria-live="polite">
              {filteredProducts.length} of {products.length}{" "}
              {products.length === 1 ? "product" : "products"}
            </span>
          </div>
        </section>

        {/* ERROR */}
        {error && (
          <div className="admin-error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* PRODUCTS */}
        <section className="admin-products-card admin-product-list-card">
          {loading ? (
            <div className="admin-empty-state">
              <div className="admin-loading-spinner" />

              <h3>Loading products...</h3>

              <p>Please wait.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="admin-empty-state">
              <div className="admin-empty-icon">📦</div>

              <h3>
                {products.length === 0
                  ? "No products yet"
                  : "No products found"}
              </h3>

              <p>
                {products.length === 0
                  ? "Create your first product to start selling."
                  : "Try a different search term or status filter."}
              </p>

              {products.length === 0 && (
                <Link
                  href="/admin/products/new"
                  className="admin-primary-button"
                >
                  + Add Product
                </Link>
              )}
            </div>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-products-table admin-product-list-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Featured</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map((product) => {
                    const isDeleting =
                      deletingId === product.id;

                    return (
                      <tr key={product.id}>
                        {/* PRODUCT */}
                        <td>
                          <div className="product-table-info">
                            <div className="product-table-image">
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                />
                              ) : (
                                <span>📦</span>
                              )}
                            </div>

                            <div>
                              <strong>
                                {product.name}
                              </strong>

                              {product.title && (
                                <small>
                                  {product.title}
                                </small>
                              )}

                              <small>
                                SKU: {product.sku}
                              </small>
                            </div>
                          </div>
                        </td>

                        {/* CATEGORY */}
                        <td>
                          <span className="category-badge">
                            {product.category?.name ||
                              "Uncategorized"}
                          </span>
                        </td>

                        {/* PRICE */}
                        <td>
                          <div className="product-price-cell">
                            <strong>
                              {formatPrice(
                                product.discountPrice ??
                                  product.price
                              )}
                            </strong>

                            {product.discountPrice !==
                              null &&
                              product.discountPrice !==
                                undefined && (
                                <del>
                                  {formatPrice(
                                    product.price
                                  )}
                                </del>
                              )}
                          </div>
                        </td>

                        {/* STOCK */}
                        <td>
                          <div className="admin-product-stock">
                            <span
                              className={
                                product.stock <= 0
                                  ? "stock-out"
                                  : product.stock <= 5
                                    ? "stock-low"
                                    : "stock-good"
                              }
                            >
                              {product.stock}
                            </span>
                            <small>
                              {product.stock <= 0
                                ? "Out of stock"
                                : product.stock <= 5
                                  ? "Low stock"
                                  : "In stock"}
                            </small>
                          </div>
                        </td>

                        {/* STATUS */}
                        <td>
                          <span
                            className={
                              product.availability &&
                              product.status === "ACTIVE"
                                ? "status-badge status-active"
                                : "status-badge status-inactive"
                            }
                          >
                            {product.availability &&
                            product.status === "ACTIVE"
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </td>

                        {/* FEATURED */}
                        <td>
                          {product.featured ? (
                            <span className="featured-badge">
                              ★ Featured
                            </span>
                          ) : (
                            <span className="not-featured">
                              —
                            </span>
                          )}
                        </td>

                        {/* ACTIONS */}
                        <td>
                          <div className="product-actions">
                            {/* EDIT */}
                            <Link
                              href={`/admin/products/${product.id}/edit`}
                              className="action-btn"
                              aria-disabled={isDeleting}
                              onClick={(event) => {
                                if (isDeleting) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              Edit
                            </Link>

                            {/* DELETE */}
                            <button
                              type="button"
                              className="action-btn delete-action"
                              onClick={() =>
                                handleDelete(product)
                              }
                              disabled={isDeleting}
                            >
                              {isDeleting
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}