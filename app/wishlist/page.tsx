import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import WishlistProducts from "./wishlist-products";

export default async function WishlistPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="account-page">
      <section className="account-content">
        <div className="account-welcome">
          <div>
            <span className="account-eyebrow">YOUR SAVED PRODUCTS</span>
            <h1>Wishlist</h1>
            <p>Keep the products you are interested in together.</p>
          </div>
        </div>

        <WishlistProducts />
      </section>
    </main>
  );
}
