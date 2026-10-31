"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  images: string[];
  price: string;
  salePrice: string | null;
  category: { name: string; slug: string };
};

export default function CustomPrintPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProducts() {
      try {
        const response = await fetch("/api/custom-print/products", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Custom products could not be loaded.");
        if (active) setProducts(data.products as Product[]);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load custom products.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProducts();
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Make it yours</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Custom Print Products</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Choose a product, upload your design, place it on the print area and preview it on the 3D model.</p>
        </header>
        {loading ? <p className="rounded-xl bg-white p-8 text-slate-500">Loading products...</p> :
          error ? <p role="alert" className="rounded-xl bg-red-50 p-6 text-red-800">{error}</p> :
          products.length === 0 ? <p className="rounded-xl bg-white p-8 text-slate-500">No custom print products are available yet.</p> :
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const image = product.image || product.images[0];
              return (
                <Link key={product.id} href={`/custom-print/${encodeURIComponent(product.slug)}`} className="overflow-hidden rounded-xl bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative aspect-square bg-slate-100">
                    {image ? <Image src={image} alt={product.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-slate-400">Product image</div>}
                  </div>
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-wide text-blue-700">{product.category.name}</p>
                    <h2 className="mt-1 font-semibold text-slate-900">{product.name}</h2>
                    {product.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.description}</p>}
                    <p className="mt-3 font-bold text-slate-900">
                      ₹{Number(product.salePrice ?? product.price).toFixed(2)}
                      {product.salePrice && <span className="ml-2 text-sm font-normal text-slate-400 line-through">₹{Number(product.price).toFixed(2)}</span>}
                    </p>
                    <span className="mt-3 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Personalize</span>
                  </div>
                </Link>
              );
            })}
          </div>}
      </div>
    </main>
  );
}
