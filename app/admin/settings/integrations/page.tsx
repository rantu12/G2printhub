import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import IntegrationsSettingsForm from "../integrations-settings-form";

export default async function AdminIntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/account");

  return (
    <main className="admin-products-page">
      <div className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <div className="admin-breadcrumb">
              <Link href="/admin">Dashboard</Link>
              <span>/</span>
              <Link href="/admin/settings">Settings</Link>
              <span>/</span>
              <span>Integrations</span>
            </div>
            <h1>Integration credentials</h1>
            <p>
              Manage credentials for Google sign-in, Resend email delivery, and
              Cashfree Payments.
            </p>
          </div>
          <Link href="/admin/settings" className="admin-secondary-button">
            Store settings
          </Link>
        </header>
        <IntegrationsSettingsForm />
      </div>
    </main>
  );
}
