"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type FooterMenuItem = {
  id: string;
  label: string;
  href: string;
};

type SiteFooterProps = {
  initialSiteName: string;
  initialSupportEmail: string;
  initialSupportPhone: string;
  initialStoreAddress: string;
};

export default function SiteFooter({
  initialSiteName,
  initialSupportEmail,
  initialSupportPhone,
  initialStoreAddress,
}: SiteFooterProps) {
  const pathname = usePathname();
  const [items, setItems] = useState<FooterMenuItem[]>([]);

  useEffect(() => {
    if (
      pathname.startsWith("/admin") ||
      pathname === "/login" ||
      pathname === "/register"
    ) {
      return;
    }

    async function loadMenu() {
      try {
        const response = await fetch("/api/footer-menu", { cache: "no-store" });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load footer menu.");
        }

        setItems(data.items);
      } catch (error) {
        console.error("Store footer menu load error:", error);
      }
    }

    loadMenu();
  }, [pathname]);

  if (
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return null;
  }

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link href="/" className="site-footer-brand">
          {initialSiteName}
        </Link>
        <nav className="site-footer-menu" aria-label="Footer menu">
          {items
            .filter((item) => item.href !== "/help" && item.href !== "/support")
            .map((item) => (
              <Link key={item.id} href={item.href}>
                {item.label}
              </Link>
            ))}
          <Link href="/help">Help Center</Link>
          <Link href="/support">Support</Link>
        </nav>
        {(initialSupportEmail || initialSupportPhone || initialStoreAddress) && (
          <div className="site-footer-contact">
            {initialStoreAddress && <span>{initialStoreAddress}</span>}
            {initialSupportEmail && (
              <a href={`mailto:${initialSupportEmail}`}>{initialSupportEmail}</a>
            )}
            {initialSupportPhone && (
              <a href={`tel:${initialSupportPhone}`}>{initialSupportPhone}</a>
            )}
          </div>
        )}
      </div>
    </footer>
  );
}
