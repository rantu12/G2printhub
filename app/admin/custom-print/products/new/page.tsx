"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import type { PrintArea } from "@/components/custom-print/CustomPrint3DViewer";
import { fetchAdmin } from "@/lib/admin-fetch";

const CustomPrint3DViewer = dynamic(
  () => import("@/components/custom-print/CustomPrint3DViewer"),
  { ssr: false, loading: () => <div className="flex h-[420px] items-center justify-center rounded-xl bg-slate-200">3D viewer loading...</div> }
);

type Category = { id: string; name: string };
type Model = { id: string; name: string; modelType: string; modelUrl: string; printAreas: unknown; active: boolean; _count?: { products: number } };
type GalleryFile = { id: string; file: File; preview: string };
type ConfiguredArea = PrintArea & { id: string; name: string; surface: string; widthCm: number; heightCm: number };

function makeSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function readAreas(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((value): ConfiguredArea[] => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const area = value as Record<string, unknown>;
    if (
      typeof area.id !== "string" ||
      typeof area.name !== "string" ||
      typeof area.surface !== "string" ||
      (area.shape !== "rectangle" && area.shape !== "circle") ||
      typeof area.widthCm !== "number" ||
      typeof area.heightCm !== "number" ||
      typeof area.x !== "number" ||
      typeof area.y !== "number" ||
      typeof area.rotation !== "number"
    ) return [];
    return [{
      id: area.id,
      name: area.name,
      surface: area.surface,
      shape: area.shape,
      widthCm: area.widthCm,
      heightCm: area.heightCm,
      x: area.x,
      y: area.y,
      rotation: area.rotation,
      ...(area.anchor && typeof area.anchor === "object" ? { anchor: area.anchor as ConfiguredArea["anchor"] } : {}),
    }];
  });
}

export default function NewCustomPrintProductPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [modelId, setModelId] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("0");
  const [colors, setColors] = useState("");
  const [sizes, setSizes] = useState("");
  const [images, setImages] = useState<GalleryFile[]>([]);
  const [message, setMessage] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [saving, setSaving] = useState(false);
  const imageUrls = useRef(new Set<string>());

  const selectedModel = models.find((model) => model.id === modelId);
  const modelAreas = useMemo(() => readAreas(selectedModel?.printAreas), [selectedModel]);

  useEffect(() => {
    let active = true;
    const urls = imageUrls.current;
    async function loadOptions() {
      try {
        const [categoryResponse, modelResponse] = await Promise.all([
          fetchAdmin("/api/admin/custom-print/categories", { cache: "no-store" }),
          fetchAdmin("/api/admin/custom-print/models", { cache: "no-store" }),
        ]);
        const [categoryData, modelData] = await Promise.all([categoryResponse.json(), modelResponse.json()]);
        if (!categoryResponse.ok || !categoryData.success) throw new Error(categoryData.message || "Categories could not be loaded.");
        if (!modelResponse.ok || !modelData.success) throw new Error(modelData.message || "3D models could not be loaded.");
        if (!active) return;
        const activeModels = (modelData.models as Model[]).filter((model) => model.active);
        setCategories(categoryData.categories as Category[]);
        setModels(activeModels);
        setCategoryId((categoryData.categories as Category[])[0]?.id ?? "");
        setModelId(activeModels[0]?.id ?? "");
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load product options.");
      }
    }
    void loadOptions();
    return () => {
      active = false;
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  function addImages(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    if (images.length + incoming.length > 6) {
      setMessage("Choose between 3 and 6 product display images.");
      return;
    }
    if (incoming.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage("Product images must be JPG, PNG, or WebP files up to 5 MB each.");
      return;
    }
    const newImages = incoming.map((file) => {
      const preview = URL.createObjectURL(file);
      imageUrls.current.add(preview);
      return { id: crypto.randomUUID(), file, preview };
    });
    setImages((current) => [...current, ...newImages]);
    setMessage("");
  }

  function removeImage(id: string) {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.preview);
        imageUrls.current.delete(removed.preview);
      }
      return current.filter((image) => image.id !== id);
    });
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setCreatedId("");
    if (images.length < 3 || images.length > 6) {
      setMessage("Add 3 to 6 product display images before saving.");
      return;
    }
    if (!categoryId || !modelId) {
      setMessage("Create/select a category and select a 3D model first.");
      return;
    }
    setSaving(true);
    try {
      const uploadedImages: string[] = [];
      for (const item of images) {
        const formData = new FormData();
        formData.append("image", item.file);
        const response = await fetchAdmin("/api/admin/custom-print/products/upload-image", { method: "POST", body: formData });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || `Unable to upload ${item.file.name}.`);
        uploadedImages.push(data.image);
      }

      const response = await fetchAdmin("/api/admin/custom-print/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug || makeSlug(name),
          sku: sku.trim(),
          categoryId,
          modelId,
          description: description.trim(),
          image: uploadedImages[0],
          images: uploadedImages,
          price: Number(price),
          salePrice: salePrice ? Number(salePrice) : null,
          stock: Number(stock),
          colors: colors.split(",").map((color) => color.trim()).filter(Boolean),
          sizes: sizes.split(",").map((size) => size.trim()).filter(Boolean),
          availability: true,
          active: true,
          customizationSettings: { allowArtwork: true, allowText: true },
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Product could not be saved.");
      setCreatedId(data.product.id);
      setMessage("Custom Print product created and linked to its 3D model.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create the product.");
    } finally {
      setSaving(false);
    }
  }

  async function createCategory() {
    const categoryName = window.prompt("Enter a category name (for example: Drinkware):");
    if (!categoryName?.trim()) return;
    const categorySlug = makeSlug(categoryName);
    try {
      const response = await fetchAdmin("/api/admin/custom-print/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim(), slug: categorySlug }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Category could not be created.");
      setCategories((current) => [...current, data.category]);
      setCategoryId(data.category.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create a category.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <header className="mb-5 rounded-xl bg-blue-800 p-5 text-white">
        <h1 className="text-2xl font-bold">Create Custom Print Product</h1>
        <p className="mt-1 text-sm text-blue-100">Choose a saved 3D model, product details and 3–6 display images.</p>
      </header>
      <form onSubmit={createProduct} className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <section className="space-y-4 rounded-xl bg-white p-5 shadow">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Product name
              <input required maxLength={160} className="mt-1 w-full rounded-md border p-2" value={name} onChange={(event) => {
                setName(event.target.value);
                if (!slug) setSlug(makeSlug(event.target.value));
              }} />
            </label>
            <label className="text-sm font-medium">Product ID / SKU
              <input required maxLength={80} className="mt-1 w-full rounded-md border p-2" value={sku} onChange={(event) => setSku(event.target.value.toUpperCase().replace(/\s+/g, "-"))} />
            </label>
            <label className="text-sm font-medium">Product URL slug
              <input required className="mt-1 w-full rounded-md border p-2" value={slug} onChange={(event) => setSlug(makeSlug(event.target.value))} />
            </label>
            <div className="flex items-end gap-2">
              <label className="flex-1 text-sm font-medium">Category
                <select required className="mt-1 w-full rounded-md border p-2" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={createCategory} className="rounded-md border px-3 py-2 text-sm">Add</button>
            </div>
            <label className="text-sm font-medium">3D model template
              <select required className="mt-1 w-full rounded-md border p-2" value={modelId} onChange={(event) => setModelId(event.target.value)}>
                <option value="">Select model</option>
                {models.map((model) => <option key={model.id} value={model.id}>{model.name} — {model.modelType}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Stock quantity
              <input required type="number" min="0" step="1" className="mt-1 w-full rounded-md border p-2" value={stock} onChange={(event) => setStock(event.target.value)} />
            </label>
            <label className="text-sm font-medium">Price (₹)
              <input required type="number" min="0" step="0.01" className="mt-1 w-full rounded-md border p-2" value={price} onChange={(event) => setPrice(event.target.value)} />
            </label>
            <label className="text-sm font-medium">Sale price (₹, optional)
              <input type="number" min="0" step="0.01" className="mt-1 w-full rounded-md border p-2" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} />
            </label>
            <label className="text-sm font-medium">Colors (comma separated)
              <input className="mt-1 w-full rounded-md border p-2" value={colors} onChange={(event) => setColors(event.target.value)} placeholder="White, Black, Blue" />
            </label>
            <label className="text-sm font-medium">Sizes (comma separated)
              <input className="mt-1 w-full rounded-md border p-2" value={sizes} onChange={(event) => setSizes(event.target.value)} placeholder="S, M, L, XL" />
            </label>
          </div>
          <label className="block text-sm font-medium">Product details
            <textarea rows={5} maxLength={10000} className="mt-1 w-full rounded-md border p-2" value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <div>
            <label className="block text-sm font-medium">Display images (3–6)</label>
            <input className="mt-2 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
              addImages(event.target.files);
              event.target.value = "";
            }} />
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {images.map((image, index) => (
                <div key={image.id} className="relative">
                  <Image src={image.preview} alt={`Product view ${index + 1}`} width={160} height={160} unoptimized className="aspect-square w-full rounded-lg border object-cover" />
                  {index === 0 && <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] text-white">Main</span>}
                  <button type="button" onClick={() => removeImage(image.id)} aria-label={`Remove image ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-white px-2 text-sm text-red-600">×</button>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">{images.length} selected</p>
          </div>
          {createdId && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">Product ID: <code>{createdId}</code> · Customer page: <code>/custom-print/{slug}</code></p>}
          {message && <p role="status" className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-blue-700 p-3 font-semibold text-white disabled:opacity-50">{saving ? "Creating product..." : "Create Custom Print Product"}</button>
        </section>

        <section className="space-y-3 rounded-xl bg-white p-5 shadow">
          <div>
            <h2 className="font-semibold">3D model and saved print areas</h2>
            <p className="text-sm text-slate-500">The selected template and its print areas are linked to this product.</p>
          </div>
          {selectedModel ? (
            <>
              <p className="text-sm">{selectedModel.name} · {selectedModel.modelType}</p>
              <CustomPrint3DViewer key={selectedModel.id} modelUrl={selectedModel.modelUrl} height={420}
                printArea={modelAreas[0] ?? null} />
              <div className="flex flex-wrap gap-2">
                {modelAreas.map((area) => <span key={area.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{area.name}</span>)}
              </div>
            </>
          ) : <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">No active model template is available. Add one in the 3D Model Library first.</p>}
        </section>
      </form>
    </main>
  );
}
