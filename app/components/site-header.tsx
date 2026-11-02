"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";

type SiteHeaderProps = {
  initialSiteName: string;
  initialSiteLogo: string;
  initialSiteFavicon: string;
};

export default function SiteHeader({
  initialSiteName,
  initialSiteLogo,
  initialSiteFavicon,
}: SiteHeaderProps) {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    if (!initialSiteFavicon) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = initialSiteFavicon;
  }, [initialSiteFavicon]);

  useEffect(() => {
    if (
      pathname.startsWith("/admin") ||
      pathname === "/login" ||
      pathname === "/register"
    ) {
      return;
    }

    async function checkAuthentication() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data: unknown = await response.json();
        if (
          !response.ok ||
          !data ||
          typeof data !== "object" ||
          !("user" in data) ||
          !data.user ||
          typeof data.user !== "object"
        ) {
          setIsAuthenticated(false);
          setAccountName("");
          return;
        }

        setIsAuthenticated(true);
        setAccountName(
          "name" in data.user && typeof data.user.name === "string"
            ? data.user.name.trim()
            : ""
        );
      } catch (error) {
        console.error("Store header authentication check failed:", error);
        setIsAuthenticated(false);
        setAccountName("");
      }
    }

    checkAuthentication();
  }, [pathname]);

  if (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return null;
  }

  return (
    <nav className="shop-top-nav" aria-label="Store navigation">
      <div className="shop-top-nav-inner">
        <Link href="/" className="shop-top-nav-logo" aria-label={`${initialSiteName} home`}>
          {initialSiteLogo ? (
            <span
              className="shop-top-nav-logo-image"
              aria-hidden="true"
              style={{
                backgroundImage: `url("${initialSiteLogo.replaceAll('"', "%22")}")`,
              }}
            />
          ) : null}
          <span>{initialSiteName}</span>
        </Link>
        <div className="shop-top-nav-links">
          <Link href="/">Home</Link>
          <Link href="/products">Products</Link>
          <Link href="/custom-print">Custom Print</Link>
          <Link href="/orders">Orders</Link>
          <Link href="/cart">
            Cart{itemCount > 0 ? ` (${itemCount})` : ""}
          </Link>
          <Link href="/help">Help Center</Link>
          <Link href="/support">Support</Link>
        </div>
        <div className="shop-top-nav-account">
          <Link href="/account" className="shop-top-nav-account-link">
            {accountName || "My Account"}
          </Link>
          {isAuthenticated ? (
            <form action="/api/auth/logout" method="POST">
              <button className="shop-top-nav-logout" type="submit">
                Logout
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="shop-top-nav-logout shop-top-nav-sign-in"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
