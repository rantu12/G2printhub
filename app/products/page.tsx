import { Suspense } from "react";
import ProductsPageClient from "./products-page-client";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <main className="shop-page">
          <section className="shop-container shop-content">
            <div className="shop-state">
              <div className="shop-spinner" />
              <h3>Loading products...</h3>
            </div>
          </section>
        </main>
      }
    >
      <ProductsPageClient />
    </Suspense>
  );
}
