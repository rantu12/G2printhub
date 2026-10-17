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

export type WishlistProduct = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  price: string | number;
  discountPrice?: string | number | null;
  categoryName?: string;
};

type WishlistContextValue = {
  products: WishlistProduct[];
  ready: boolean;
  hasProduct: (productId: string) => boolean;
  toggleProduct: (product: WishlistProduct) => void;
  removeProduct: (productId: string) => void;
};

const STORAGE_KEY = "printhub_wishlist_v1";
const WishlistContext = createContext<WishlistContextValue | undefined>(
  undefined
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isWishlistProduct(value: unknown): value is WishlistProduct {
  if (!isRecord(value)) return false;
  const product = value;
  return (
    typeof product.id === "string" &&
    typeof product.name === "string" &&
    typeof product.slug === "string" &&
    (typeof product.image === "string" || product.image === null) &&
    (typeof product.price === "string" || typeof product.price === "number") &&
    (product.discountPrice === undefined ||
      product.discountPrice === null ||
      typeof product.discountPrice === "string" ||
      typeof product.discountPrice === "number") &&
    (product.categoryName === undefined ||
      typeof product.categoryName === "string")
  );
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Load browser storage only after mount to avoid server/client mismatches.
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setProducts(parsed.filter(isWishlistProduct));
        }
      }
    } catch (error) {
      console.error("Unable to restore PrintHub wishlist:", error);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch (error) {
      console.error("Unable to save PrintHub wishlist:", error);
    }
  }, [products, ready]);

  const hasProduct = useCallback(
    (productId: string) => products.some((product) => product.id === productId),
    [products]
  );

  const removeProduct = useCallback((productId: string) => {
    setProducts((current) =>
      current.filter((product) => product.id !== productId)
    );
  }, []);

  const toggleProduct = useCallback((product: WishlistProduct) => {
    setProducts((current) =>
      current.some((saved) => saved.id === product.id)
        ? current.filter((saved) => saved.id !== product.id)
        : [...current, product]
    );
  }, []);

  const value = useMemo(
    () => ({ products, ready, hasProduct, toggleProduct, removeProduct }),
    [products, ready, hasProduct, toggleProduct, removeProduct]
  );

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used inside WishlistProvider");
  }
  return context;
}
