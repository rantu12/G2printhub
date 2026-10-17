"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";

export default function SiteHeader() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [siteName, setSiteName] = useState("PrintHub");
  const [siteLogo, setSiteLogo] = useState("");
  const [siteFavicon, setSiteFavicon] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/store-settings/public", { cache: "no-store" })
      .then(async (response) => {
        const data: unknown = await response.json();
        if (
          !response.ok ||
          !data ||
          typeof data !== "object" ||
          !("settings" in data) ||
          !data.settings ||
          typeof data.settings !== "object"
        ) {
          throw new Error("Unable to load public store identity.");
        }
        const settings = data.settings as Record<string, unknown>;
        if (!active) return;
        if (typeof settings.siteName === "string" && settings.siteName.trim()) {
          setSiteName(settings.siteName.trim());
        }
        if (typeof settings.siteLogo === "string") setSiteLogo(settings.siteLogo);
        if (typeof settings.siteFavicon === "string") {
          setSiteFavicon(settings.siteFavicon);
        }
      })
      .catch((error: unknown) => {
        console.error("Store header identity load failed:", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!siteFavicon) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = siteFavicon;
  }, [siteFavicon]);

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
        <Link href="/" className="shop-top-nav-logo" aria-label={`${siteName} home`}>
          <span
            className="shop-top-nav-logo-icon"
            aria-hidden="true"
            style={
              siteLogo
                ? {
                    backgroundImage: `url("${siteLogo.replaceAll('"', "%22")}")`,
                    backgroundPosition: "center",
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    color: "transparent",
                  }
                : undefined
            }
          >
            P
          </span>
          <span>{siteName}</span>
        </Link>
        <div className="shop-top-nav-links">
          <Link href="/">Home</Link>
          <Link href="/products">Products</Link>
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
