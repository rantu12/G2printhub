import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import AddressForm from "./address-form";

export default async function AddressesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="account-page">
      <section className="account-content">
        <div className="account-welcome">
          <div>
            <span className="account-eyebrow">DELIVERY DETAILS</span>
            <h1>My Address</h1>
            <p>
              Save your contact and delivery information for faster checkout.
            </p>
          </div>
        </div>

        <div className="account-address-toolbar">
          <Link href="/account" className="account-address-back">
            ← Back to account
          </Link>
        </div>

        <AddressForm initialName={user.name} initialEmail={user.email} />
      </section>
    </main>
  );
}
