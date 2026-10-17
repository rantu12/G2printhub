"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import WishlistButton from "@/app/components/wishlist-button";
import { useCart } from "@/lib/cart-context";
import ProductColorSelector from "./ProductColorSelector";
import ProductImageCarousel from "./ProductImageCarousel";
import {
  formatPrice,
  getDiscountPercent,
  getProductColors,
  type CatalogProduct,
} from "./types";

export default function ProductCard({ product }: { product: CatalogProduct }) {
  const colors = useMemo(() => getProductColors(product), [product]);
  const [selectedColor, setSelectedColor] = useState<string>(
    colors[0]?.name ?? ""
  );
  const [selectedSize, setSelectedSize] = useState("");
  const [notice, setNotice] = useState("");
  const { addToCart, ready: cartReady } = useCart();
  const discount = getDiscountPercent(product);
  const images =
    product.images.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];
  const colorIndex = product.colors.length
    ? colors.findIndex((color) => color.name === selectedColor)
    : 0;

  function addProductToCart() {
    setNotice("");
    if (!cartReady) {
      setNotice("Your cart is loading. Please try again.");
      return;
    }
    if (product.stock < 1) {
      setNotice("This product is currently out of stock.");
      return;
    }
    if (product.sizes.length > 0 && !selectedSize) {
      setNotice("Choose a size before adding this product to your cart.");
      return;
    }
    const cartProduct = {
      id: product.id,
      name: product.name,
      title: product.title,
      slug: product.slug,
      image: product.image,
      price: product.price,
      discountPrice: product.discountPrice,
      stock: product.stock,
      category: product.category,
    };
    if (
      addToCart(
        cartProduct,
        1,
        undefined,
        selectedColor || undefined,
        selectedSize || undefined
      )
    ) {
      setNotice("Added to cart.");
      return;
    }
    setNotice("Unable to add this item to your cart.");
  }

  return (
    <article className="shop-product-card catalog-product-card">
      <div className="shop-product-visual">
        <ProductImageCarousel
          key={`${product.id}-${selectedColor}`}
          images={images}
          name={product.name}
          href={`/products/${product.slug}`}
          selectedColor={selectedColor}
          colorIndex={colorIndex}
          featured={product.featured}
          discount={discount}
        />
        <WishlistButton
          product={{
            id: product.id,
            name: product.name,
            slug: product.slug,
            image: product.image,
            price: product.price,
            discountPrice: product.discountPrice,
            categoryName: product.category.name,
          }}
        />
      </div>

      <div className="shop-product-info">
        <span className="shop-product-category">{product.category.name}</span>
        {product.customerArtworkEnabled && (
          <span className="catalog-customizable">Customizable</span>
        )}
        <h2>
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h2>
        {product.title && <p>{product.title}</p>}

        <div className="catalog-rating">
          <span aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <span
                key={index}
                className={
                  product.rating !== null && index < Math.round(product.rating)
                    ? "is-filled"
                    : ""
                }
              >
                ★
              </span>
            ))}
          </span>
          <span>
            {product.reviewCount > 0 && product.rating !== null
              ? `${product.rating.toFixed(1)} (${product.reviewCount})`
              : "No reviews yet"}
          </span>
        </div>

        <div className="shop-product-price">
          <strong>{formatPrice(product.discountPrice ?? product.price)}</strong>
          {discount > 0 && <del>{formatPrice(product.price)}</del>}
          {discount > 0 && (
            <span className="catalog-savings">{discount}% off</span>
          )}
        </div>

        {colors.length > 0 && (
          <ProductColorSelector
            colors={colors}
            selectedColor={selectedColor}
            onSelect={(color) => {
              setSelectedColor(color);
              setNotice("");
            }}
          />
        )}
        {product.sizes.length > 0 && (
          <fieldset className="product-size-selector">
            <legend>Size: <strong>{selectedSize || "Choose size"}</strong></legend>
            <div>
              {product.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={selectedSize === size ? "is-selected" : ""}
                  aria-pressed={selectedSize === size}
                  onClick={() => {
                    setSelectedSize(size);
                    setNotice("");
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <div className="shop-product-bottom catalog-stock">
          <span className={product.stock > 0 ? "shop-in-stock" : "shop-out-stock"}>
            {product.stock > 0
              ? `${product.stock} in stock`
              : "Out of stock"}
          </span>
        </div>

        <div className="catalog-card-actions">
          <button
            type="button"
            className="catalog-add-button"
            onClick={addProductToCart}
            disabled={product.stock < 1}
          >
            Add to Cart
          </button>
          <Link
            className="catalog-customize-button"
            href={`/products/${product.slug}`}
          >
            {product.customerArtworkEnabled ? "Buy Now" : "Details"}
          </Link>
        </div>
        <p className="catalog-cart-notice" aria-live="polite">
          {notice}
        </p>
      </div>
    </article>
  );
}
