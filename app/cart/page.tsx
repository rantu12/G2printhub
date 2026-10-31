
"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

export default function CartPage() {
  const {
    items,
    ready,
    itemCount,
    subtotal,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

  if (!ready) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-12">
        <p className="text-gray-600">Loading cart...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Shopping Cart
          </h1>
          <p className="mt-2 text-gray-600">
            {itemCount} {itemCount === 1 ? "item" : "items"} in your cart
          </p>
        </div>

        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-100"
        >
          Continue Shopping
        </Link>
      </div>

      {items.length === 0 ? (
        <section className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="mb-4 text-5xl">🛒</div>

          <h2 className="text-2xl font-semibold text-gray-900">
            Your cart is empty
          </h2>

          <p className="mt-3 text-gray-600">
            Browse our products and add something to your cart.
          </p>

          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700"
          >
            Browse Products
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
          <section className="space-y-4 lg:col-span-2">
            {items.map(({ product, quantity, artwork }) => {
              const unitPrice = Number(
                product.discountPrice ?? product.price
              );

              return (
                <article
                  key={`${product.productType ?? "PRODUCT"}:${product.id}:${product.selectedColor ?? "default"}:${product.selectedSize ?? "default"}:${artwork?.id ?? "no-artwork"}`}
                  className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100 sm:w-28">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl">🖨️</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={
                        product.productType === "CUSTOM_PRINT"
                          ? `/custom-print/${product.slug}`
                          : `/products/${product.slug}`
                      }
                      className="text-lg font-semibold text-gray-900 hover:text-indigo-600"
                    >
                      {product.name}
                    </Link>

                    <p className="mt-2 text-sm text-gray-500">
                      Unit price: ₹{unitPrice.toFixed(2)}
                    </p>
                    {product.selectedColor && (
                      <p className="mt-1 text-sm text-gray-600">
                        Color: {product.selectedColor}
                      </p>
                    )}
                    {product.selectedSize && (
                      <p className="mt-1 text-sm text-gray-600">
                        Size: {product.selectedSize}
                      </p>
                    )}

                    <p className="mt-1 font-semibold text-gray-900">
                      Total: ₹{(unitPrice * quantity).toFixed(2)}
                    </p>
                    {artwork && artwork.fileName && (
                      <p className="mt-2 text-sm text-gray-600">
                        Print file: <strong>{artwork.fileName}</strong>
                      </p>
                    )}
                    {artwork && !artwork.fileName && (
                      <p className="mt-2 text-sm text-gray-600">
                        Personalization details attached
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <div className="flex items-center overflow-hidden rounded-lg border border-gray-300">
                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            product.id,
                            quantity - 1,
                            product.selectedColor ?? null,
                            product.selectedSize ?? null,
                            product.productType ?? "PRODUCT",
                            artwork?.id
                          )
                        }
                        disabled={quantity <= 1}
                        aria-label={`Decrease quantity of ${product.name}`}
                        className="px-3 py-2 text-lg hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        −
                      </button>

                      <span className="min-w-10 px-3 text-center font-medium">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          updateQuantity(
                            product.id,
                            quantity + 1,
                            product.selectedColor ?? null,
                            product.selectedSize ?? null,
                            product.productType ?? "PRODUCT",
                            artwork?.id
                          )
                        }
                        disabled={quantity >= 99 || quantity >= product.stock}
                        aria-label={`Increase quantity of ${product.name}`}
                        className="px-3 py-2 text-lg hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        removeFromCart(
                          product.id,
                          product.selectedColor ?? null,
                          product.selectedSize ?? null,
                          product.productType ?? "PRODUCT",
                          artwork?.id
                        )
                      }
                      className="text-sm font-medium text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Remove all items from your cart?")) {
                    clearCart();
                  }
                }}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
              >
                Clear Cart
              </button>
            </div>
          </section>

          <aside className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Order Summary
            </h2>

            <div className="mt-6 space-y-4">
              <div className="flex justify-between gap-4 text-gray-600">
                <span>Items</span>
                <span>{itemCount}</span>
              </div>

              <div className="flex justify-between gap-4 text-gray-600">
                <span>Subtotal</span>
                <span>₹{Number(subtotal).toFixed(2)}</span>
              </div>

              <div className="flex justify-between gap-4 text-gray-600">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between gap-4 text-lg font-bold text-gray-900">
                  <span>Subtotal</span>
                  <span>₹{Number(subtotal).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <Link
              href="/checkout"
              className="mt-6 block rounded-lg bg-indigo-600 px-5 py-3 text-center font-semibold text-white transition hover:bg-indigo-700"
            >
              Proceed to Checkout
            </Link>

            <p className="mt-4 text-center text-xs leading-5 text-gray-500">
              Final product prices and availability will be verified when
              you place your order.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
