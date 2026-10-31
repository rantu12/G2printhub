"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartProduct = {
  id: string;
  name: string;
  title?: string | null;
  slug: string;
  image?: string | null;
  selectedColor?: string;
  selectedSize?: string;
  price: string | number;
  discountPrice?: string | number | null;
  stock: number;
  category?: {
    id?: string;
    name: string;
    slug?: string;
  };
};

export type CartItem = {
  product: CartProduct;
  quantity: number;
  artwork?: {
    id: string;
    fileName: string | null;
  };
};

type CartContextType = {
  items: CartItem[];
  ready: boolean;
  itemCount: number;
  subtotal: number;
  addToCart: (
    product: CartProduct,
    quantity?: number,
    artwork?: CartItem["artwork"] | null,
    selectedColor?: string,
    selectedSize?: string
  ) => boolean;
  updateArtwork: (
    productId: string,
    artwork: CartItem["artwork"] | null
  ) => void;
  updateQuantity: (
    productId: string,
    quantity: number,
    selectedColor?: string | null,
    selectedSize?: string | null
  ) => void;
  removeFromCart: (
    productId: string,
    selectedColor?: string | null,
    selectedSize?: string | null
  ) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "printhub_cart_v1";

const CartContext = createContext<CartContextType | undefined>(undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isCartProduct(value: unknown): value is CartProduct {
  if (!isRecord(value)) return false;

  const category = value.category;
  const validCategory =
    category === undefined ||
    (isRecord(category) &&
      typeof category.name === "string" &&
      (category.id === undefined || typeof category.id === "string") &&
      (category.slug === undefined || typeof category.slug === "string"));

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.slug === "string" &&
    typeof value.stock === "number" &&
    Number.isFinite(value.stock) &&
    value.stock >= 0 &&
    (typeof value.price === "string" || typeof value.price === "number") &&
    (value.title === undefined ||
      value.title === null ||
      typeof value.title === "string") &&
    (value.image === undefined ||
      value.image === null ||
      typeof value.image === "string") &&
    (value.selectedColor === undefined ||
      typeof value.selectedColor === "string") &&
    (value.selectedSize === undefined ||
      typeof value.selectedSize === "string") &&
    (value.discountPrice === undefined ||
      value.discountPrice === null ||
      typeof value.discountPrice === "string" ||
      typeof value.discountPrice === "number") &&
    validCategory
  );
}

function isCartItem(value: unknown): value is CartItem {
  return (
    isRecord(value) &&
    typeof value.quantity === "number" &&
    Number.isInteger(value.quantity) &&
    value.quantity > 0 &&
    isCartProduct(value.product) &&
    (value.artwork === undefined ||
      (isRecord(value.artwork) &&
        typeof value.artwork.id === "string" &&
        (value.artwork.fileName === null ||
          typeof value.artwork.fileName === "string")))
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed: unknown = JSON.parse(saved);

        if (Array.isArray(parsed)) {
          // Loading after mount avoids reading browser storage during server rendering.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setItems(
            parsed
              .filter(isCartItem)
              .map((item) => ({
                ...item,
                quantity: Math.min(item.quantity, item.product.stock),
              }))
              .filter((item) => item.quantity > 0)
          );
        }
      }
    } catch (error) {
      console.error("Unable to restore PrintHub cart:", error);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Unable to save PrintHub cart:", error);
    }
  }, [items, ready]);

  const addToCart = useCallback(
    (
      product: CartProduct,
      requestedQuantity = 1,
      artwork?: CartItem["artwork"] | null,
      selectedColor?: string,
      selectedSize?: string
    ): boolean => {
      if (!ready || !isCartProduct(product) || product.stock <= 0) return false;
      if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0) {
        return false;
      }

      const quantity = Math.min(
        Math.max(1, Math.floor(requestedQuantity)),
        product.stock
      );
      const selectedProduct = {
        ...product,
        ...(selectedColor ? { selectedColor } : {}),
        ...(selectedSize ? { selectedSize } : {}),
      };

      setItems((current) => {
        const existing = current.find(
          (item) =>
            item.product.id === product.id &&
            (item.product.selectedColor ?? null) ===
              (selectedColor ?? null) &&
            (item.product.selectedSize ?? null) === (selectedSize ?? null)
        );

        if (existing) {
          const nextQuantity = Math.min(
            existing.quantity + quantity,
            selectedProduct.stock
          );

          if (
            nextQuantity === existing.quantity &&
            artwork === undefined
          ) {
            return current;
          }

          return current.map((item) =>
            item.product.id === product.id &&
            (item.product.selectedColor ?? null) ===
              (selectedColor ?? null) &&
            (item.product.selectedSize ?? null) === (selectedSize ?? null)
              ? {
                  ...item,
                  product: selectedProduct,
                  quantity: nextQuantity,
                  artwork:
                    artwork === undefined ? item.artwork : artwork ?? undefined,
                }
              : item
          );
        }

        return [
          ...current,
          {
            product: selectedProduct,
            quantity,
            artwork: artwork ?? undefined,
          },
        ];
      });

      return true;
    },
    [ready]
  );

  const updateArtwork = useCallback(
    (productId: string, artwork: CartItem["artwork"] | null) => {
      setItems((current) =>
        current.map((item) =>
          item.product.id === productId
            ? { ...item, artwork: artwork ?? undefined }
            : item
        )
      );
    },
    []
  );

  const updateQuantity = useCallback(
    (
      productId: string,
      quantity: number,
      selectedColor: string | null = null,
      selectedSize: string | null = null
    ) => {
      if (!Number.isInteger(quantity) || quantity < 1) return;

      setItems((current) =>
        current
          .map((item) =>
            item.product.id === productId &&
            (item.product.selectedColor ?? null) === selectedColor &&
            (item.product.selectedSize ?? null) === selectedSize
              ? {
                  ...item,
                  quantity: Math.min(quantity, item.product.stock),
                }
              : item
          )
          .filter((item) => item.quantity > 0)
      );
    },
    []
  );

  const removeFromCart = useCallback(
    (
      productId: string,
      selectedColor: string | null = null,
      selectedSize: string | null = null
    ) => {
      setItems((current) =>
        current.filter(
          (item) =>
            item.product.id !== productId ||
            (item.product.selectedColor ?? null) !== selectedColor ||
            (item.product.selectedSize ?? null) !== selectedSize
        )
      );
    },
    []
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = items.reduce((sum, item) => {
    const price = Number(item.product.discountPrice ?? item.product.price);

    return sum + (Number.isFinite(price) ? price : 0) * item.quantity;
  }, 0);

  const value = useMemo<CartContextType>(
    () => ({
      items,
      ready,
      itemCount,
      subtotal,
      addToCart,
      updateArtwork,
      updateQuantity,
      removeFromCart,
      clearCart,
    }),
    [
      items,
      ready,
      itemCount,
      subtotal,
      addToCart,
      updateArtwork,
      updateQuantity,
      removeFromCart,
      clearCart,
    ]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
