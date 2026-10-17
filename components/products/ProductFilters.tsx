"use client";

import type { ProductCategory } from "./types";

export type ProductFiltersState = {
  category: string;
  minimumPrice: string;
  maximumPrice: string;
  minimumDiscount: string;
  sort: string;
};

type ProductFiltersProps = {
  categories: ProductCategory[];
  value: ProductFiltersState;
  onChange: (value: ProductFiltersState) => void;
};

export default function ProductFilters({
  categories,
  value,
  onChange,
}: ProductFiltersProps) {
  function update<K extends keyof ProductFiltersState>(
    field: K,
    nextValue: ProductFiltersState[K]
  ) {
    onChange({ ...value, [field]: nextValue });
  }

  return (
    <div className="catalog-filter-controls" aria-label="Product filters">
      <label>
        <span>Category</span>
        <select
          value={value.category}
          onChange={(event) => update("category", event.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Sort by</span>
        <select
          value={value.sort}
          onChange={(event) => update("sort", event.target.value)}
        >
          <option value="featured">Featured</option>
          <option value="newest">Newest</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="discount">Biggest discount</option>
          <option value="rating">Top rated</option>
        </select>
      </label>

      <label>
        <span>Min price</span>
        <input
          type="number"
          min="0"
          value={value.minimumPrice}
          onChange={(event) => update("minimumPrice", event.target.value)}
          placeholder="₹0"
        />
      </label>

      <label>
        <span>Max price</span>
        <input
          type="number"
          min="0"
          value={value.maximumPrice}
          onChange={(event) => update("maximumPrice", event.target.value)}
          placeholder="No limit"
        />
      </label>

      <label>
        <span>Discount</span>
        <select
          value={value.minimumDiscount}
          onChange={(event) => update("minimumDiscount", event.target.value)}
        >
          <option value="">Any discount</option>
          <option value="1">On sale</option>
          <option value="10">10% or more</option>
          <option value="20">20% or more</option>
          <option value="30">30% or more</option>
          <option value="50">50% or more</option>
        </select>
      </label>
    </div>
  );
}
