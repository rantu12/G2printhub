import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ProfileForm from "./profile-form";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const initials = user.name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="account-page">
      <section className="account-content">
        <div className="account-welcome">
          <div>
            <span className="account-eyebrow">MY ACCOUNT</span>
            <h1>Welcome, {user.name.split(" ")[0]} 👋</h1>
            <p>
              Manage your orders, designs, profile and printing
              preferences.
            </p>
          </div>

          <div className="account-avatar">{initials}</div>
        </div>

        <div className="account-grid">
          <Link href="/orders" className="account-card">
            <div className="account-card-icon">📦</div>
            <div>
              <h2>My Orders</h2>
              <p>Track and manage your printing orders.</p>
            </div>
            <span className="card-arrow">→</span>
          </Link>

          <Link href="/designs" className="account-card">
            <div className="account-card-icon">🎨</div>
            <div>
              <h2>Saved Designs</h2>
              <p>Continue working on your saved designs.</p>
            </div>
            <span className="card-arrow">→</span>
          </Link>

          <Link href="/wishlist" className="account-card">
            <div className="account-card-icon">♡</div>
            <div>
              <h2>Wishlist</h2>
              <p>Products you saved for later.</p>
            </div>
            <span className="card-arrow">→</span>
          </Link>

          <Link href="/addresses" className="account-card">
            <div className="account-card-icon">⌖</div>
            <div>
              <h2>Addresses</h2>
              <p>Manage your delivery addresses.</p>
            </div>
            <span className="card-arrow">→</span>
          </Link>

          <Link href="/my-account/support" className="account-card">
            <div className="account-card-icon">?</div>
            <div>
              <h2>Support requests</h2>
              <p>Review your tickets and replies.</p>
            </div>
            <span className="card-arrow">→</span>
          </Link>
        </div>

        <ProfileForm
          initialProfile={{
            name: user.name,
            email: user.email,
            phone: user.phone,
          }}
          role={user.role}
        />

        <section className="account-help">
          <div>
            <span className="account-eyebrow">NEED HELP?</span>
            <h2>We&apos;re here to help.</h2>
            <p>
              Have a question about your order or custom printing
              project?
            </p>
          </div>

          <Link href="/contact" className="help-button">
            Contact support →
          </Link>
        </section>
      </section>
    </main>
  );
}