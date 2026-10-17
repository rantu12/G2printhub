import { redirect } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStoreSettings } from "@/lib/store-settings";
import RegisterForm from "./register-form";

export default async function RegisterPage() {
  await connection();
  const user = await getCurrentUser();

  if (user) {
    if (user.role === "ADMIN") {
      redirect("/admin");
    }
    redirect("/account");
  }

  const settings = await getStoreSettings();
  if (!settings.registrationEnabled) {
    return (
      <main className="auth-page register-page">
        <section className="auth-shell">
          <div className="auth-card">
            <h1>Registration is closed</h1>
            <p>Customer account registration is currently disabled.</p>
            <Link href="/login" className="secondary-auth-button">
              Return to sign in
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <RegisterForm />;
}