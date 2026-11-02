import type { Metadata } from "next";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { CartProvider } from "@/lib/cart-context";
import { getStoreSettings } from "@/lib/store-settings";
import { WishlistProvider } from "@/lib/wishlist-context";
import SiteFooter from "./components/site-footer";
import SiteHeader from "./components/site-header";
import WhatsAppChatButton from "./components/whatsapp-chat-button";
import "./globals.css";

export const metadata: Metadata = {
  title: "G2 PrintHub",
  description: "Print anything with G2 PrintHub.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return renderRootLayout(children);
}

async function renderRootLayout(children: React.ReactNode) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-printhub-pathname") ?? "/";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const maintenanceSettings = isAdminRoute ? null : await getStoreSettings();
  const currentUser =
    maintenanceSettings?.maintenanceMode ? await getCurrentUser() : null;
  const showMaintenance =
    maintenanceSettings?.maintenanceMode && currentUser?.role !== "ADMIN";

  return (
    <html lang="en">
      <body>
        {showMaintenance ? (
          <main className="store-maintenance-page">
            <div className="store-maintenance-card">
              <span className="account-eyebrow">PRINT HUB</span>
              <h1>We’ll be back soon</h1>
              <p>
                The storefront is temporarily unavailable while we make
                improvements. Please check back shortly.
              </p>
              <a href="/admin/login" className="admin-secondary-button">
                Administrator sign in
              </a>
            </div>
            <WhatsAppChatButton
              whatsappNumber={maintenanceSettings?.whatsappNumber ?? ""}
            />
          </main>
        ) : (
          <CartProvider>
            <WishlistProvider>
              <SiteHeader
                initialSiteName={maintenanceSettings?.siteName ?? "G2 PrintHub"}
                initialSiteLogo={maintenanceSettings?.siteLogo ?? ""}
                initialSiteFavicon={maintenanceSettings?.siteFavicon ?? ""}
              />
              {children}
              <SiteFooter
                initialSiteName={maintenanceSettings?.siteName ?? "G2 PrintHub"}
                initialSupportEmail={maintenanceSettings?.supportEmail ?? ""}
                initialSupportPhone={maintenanceSettings?.supportPhone ?? ""}
                initialStoreAddress={maintenanceSettings?.storeAddress ?? ""}
              />
              {!isAdminRoute && (
                <WhatsAppChatButton
                  whatsappNumber={maintenanceSettings?.whatsappNumber ?? ""}
                />
              )}
            </WishlistProvider>
          </CartProvider>
        )}
      </body>
    </html>
  );
}