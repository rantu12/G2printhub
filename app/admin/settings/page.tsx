import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import HomepageSettingsForm from "./homepage-settings-form";
import InvoiceSettingsForm from "./invoice-settings-form";
import ShippingTaxSettingsForm from "./shipping-tax-settings-form";
import StoreSettingsForm from "./store-settings-form";

export default async function AdminSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/admin/login");
  }
  if (user.role !== "ADMIN") {
    redirect("/account");
  }

  return (
    <main className="admin-products-page">
      <div className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <div className="admin-breadcrumb">
              <Link href="/admin">Dashboard</Link>
              <span>/</span>
              <span>Settings</span>
            </div>
            <h1>Store settings</h1>
            <p>
              Configure store identity, customer access, checkout pricing,
              payment integrations, and homepage content.
            </p>
          </div>
          <Link href="/admin" className="admin-secondary-button">
            ← Dashboard
          </Link>
        </header>
        <nav className="admin-settings-category-nav" aria-label="Settings categories">
          <Link href="#general-settings">General &amp; customer access</Link>
          <Link href="#checkout-settings">Shipping &amp; tax</Link>
          <Link href="/admin/settings/integrations">Payments &amp; integrations</Link>
          <Link href="#invoice-settings">Invoice</Link>
          <Link href="#homepage-settings">Homepage</Link>
        </nav>
        <div id="general-settings">
          <StoreSettingsForm />
        </div>
        <div id="checkout-settings">
          <ShippingTaxSettingsForm />
        </div>
        <div id="invoice-settings">
          <InvoiceSettingsForm />
        </div>
        <section className="admin-shipping-tax-card">
          <header>
            <span className="admin-coupon-form-eyebrow">API CREDENTIALS</span>
            <h2>Connected services</h2>
            <p>
              Configure encrypted Google sign-in, email delivery, and Cashfree
              credentials.
            </p>
          </header>
          <Link
            href="/admin/settings/integrations"
            className="admin-secondary-button"
          >
            Manage integrations
          </Link>
        </section>
        <div id="homepage-settings">
          <HomepageSettingsForm />
        </div>
      </div>
    </main>
  );
}
