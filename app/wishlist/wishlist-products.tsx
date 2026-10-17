"use client";

import Link from "next/link";
import WishlistButton from "@/app/components/wishlist-button";
import { useWishlist } from "@/lib/wishlist-context";

function formatPrice(value: string | number | null | undefined) {
  const amount = Number(value);
  return `₹${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
}

export default function WishlistProducts() {
  const { products, ready, removeProduct } = useWishlist();

  if (!ready) {
    return <div className="shop-state">Loading wishlist...</div>;
  }

  if (products.length === 0) {
    return (
      <section className="account-profile account-orders-empty">
        <h2>Your wishlist is empty</h2>
        <p>Browse our products and tap the heart to save one for later.</p>
        <Link href="/products" className="help-button">
          Browse products →
        </Link>
      </section>
    );
  }

  return (
    <div className="wishlist-products-grid">
      {products.map((product) => (
        <article className="shop-product-card" key={product.id}>
          <div className="shop-product-visual">
            <Link
              href={`/products/${encodeURIComponent(product.slug)}`}
              className="shop-product-image"
            >
              {product.image ? (
                <img src={product.image} alt={product.name} />
              ) : (
                <div className="shop-image-placeholder" aria-hidden="true">
                  ✳
                </div>
              )}
            </Link>
            <WishlistButton product={product} />
          </div>
          <div className="shop-product-info">
            <span className="shop-product-category">
              {product.categoryName ?? "Print products"}
            </span>
            <h2>{product.name}</h2>
            <div className="shop-product-price">
              <strong>
                {formatPrice(product.discountPrice ?? product.price)}
              </strong>
              {product.discountPrice && (
                <del>{formatPrice(product.price)}</del>
              )}
            </div>
            <div className="wishlist-card-actions">
              <Link
                href={`/products/${encodeURIComponent(product.slug)}`}
                className="shop-view-button"
              >
                View Product →
              </Link>
              <button
                type="button"
                className="wishlist-remove-button"
                onClick={() => removeProduct(product.id)}
              >
                Remove
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
