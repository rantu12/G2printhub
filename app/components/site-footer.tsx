"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type FooterMenuItem = {
  id: string;
  label: string;
  href: string;
};

export default function SiteFooter() {
  const pathname = usePathname();
  const [items, setItems] = useState<FooterMenuItem[]>([]);
  const [siteName, setSiteName] = useState("PrintHub");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [storeAddress, setStoreAddress] = useState("");

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

  useEffect(() => {
    let active = true;
    fetch("/api/store-settings/public", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || !data.settings) {
          throw new Error(data.message || "Unable to load store identity.");
        }
        if (!active) return;
        setSiteName(data.settings.siteName || "PrintHub");
        setSupportEmail(data.settings.supportEmail || "");
        setSupportPhone(data.settings.supportPhone || "");
        setStoreAddress(data.settings.storeAddress || "");
      })
      .catch((error: unknown) => {
        console.error("Store footer identity load error:", error);
      });
    return () => {
      active = false;
    };
  }, []);

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
          {siteName}
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
        {(supportEmail || supportPhone || storeAddress) && (
          <div className="site-footer-contact">
            {storeAddress && <span>{storeAddress}</span>}
            {supportEmail && <a href={`mailto:${supportEmail}`}>{supportEmail}</a>}
            {supportPhone && <a href={`tel:${supportPhone}`}>{supportPhone}</a>}
          </div>
        )}
      </div>
    </footer>
  );
}
