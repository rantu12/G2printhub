"use client";

import { useWishlist, type WishlistProduct } from "@/lib/wishlist-context";

export default function WishlistButton({
  product,
}: {
  product: WishlistProduct;
}) {
  const { ready, hasProduct, toggleProduct } = useWishlist();
  const saved = hasProduct(product.id);

  return (
    <button
      type="button"
      className={`wishlist-toggle${saved ? " is-saved" : ""}`}
      aria-label={`${saved ? "Remove from" : "Add to"} wishlist: ${product.name}`}
      aria-pressed={saved}
      disabled={!ready}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleProduct(product);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
      </svg>
    </button>
  );
}
