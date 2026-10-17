import ProductCard from "./ProductCard";
import type { CatalogProduct } from "./types";

export default function ProductGrid({
  products,
  loading,
}: {
  products: CatalogProduct[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="shop-grid catalog-grid" aria-label="Loading products">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="catalog-skeleton" key={index}>
            <div />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="shop-state catalog-empty">
        <div className="shop-state-icon" aria-hidden="true">⌕</div>
        <h3>No products found</h3>
        <p>Try changing your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="shop-grid catalog-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
