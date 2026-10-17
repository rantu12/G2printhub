import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import SupportPanel from "./support-panel";

export default async function AdminSupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN") redirect("/account");

  return (
    <main className="admin-support-page">
      <header className="admin-support-page-header">
        <div>
          <span className="help-center-eyebrow">ADMINISTRATION</span>
          <h1>Help &amp; Support</h1>
          <p>Search customer requests, reply, and manage ticket status.</p>
        </div>
        <Link href="/admin">← Admin dashboard</Link>
      </header>
      <SupportPanel />
    </main>
  );
}
