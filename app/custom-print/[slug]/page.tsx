"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";

const CustomPrint3DViewer = dynamic(
  () => import("@/components/custom-print/CustomPrint3DViewer"),
  { ssr: false, loading: () => <div className="flex h-[520px] items-center justify-center rounded-xl bg-slate-200">3D preview loading...</div> }
);

type SurfaceAnchor = {
  point: [number, number, number];
  normal: [number, number, number];
  meshName?: string;
};

type PrintArea = {
  id: string;
  name: string;
  surface: string;
  shape: "rectangle" | "circle";
  widthCm: number;
  heightCm: number;
  x: number;
  y: number;
  rotation: number;
  anchor?: SurfaceAnchor;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  image: string | null;
  images: string[];
  colors: string[];
  sizes: string[];
  price: string;
  salePrice: string | null;
  stock: number;
  modelUrl: string | null;
  printAreas: unknown;
  customizationSettings?: {
    allowText?: boolean;
    maxTextLength?: number;
  } | null;
  category: { name: string; slug: string };
};

type DesignPoint = { x: number; y: number; scale: number; rotation: number };
type Artwork = { id: string; fileName: string | null };

function isPrintArea(value: unknown): value is PrintArea {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const area = value as Record<string, unknown>;
  return typeof area.id === "string" &&
    typeof area.name === "string" &&
    typeof area.surface === "string" &&
    (area.shape === "rectangle" || area.shape === "circle") &&
    typeof area.widthCm === "number" &&
    typeof area.heightCm === "number" &&
    typeof area.x === "number" &&
    typeof area.y === "number" &&
    typeof area.rotation === "number";
}

function safeAreas(value: unknown) {
  return Array.isArray(value) ? value.filter(isPrintArea) : [];
}

export default function CustomPrintProductPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const { addToCart, ready: cartReady } = useCart();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [view3DOpen, setView3DOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [imagePoint, setImagePoint] = useState<DesignPoint>({ x: 50, y: 50, scale: 1, rotation: 0 });
  const [text, setText] = useState("");
  const [textColor, setTextColor] = useState("#172554");
  const [textPoint, setTextPoint] = useState<DesignPoint>({ x: 50, y: 75, scale: 1, rotation: 0 });
  const [compositeUrl, setCompositeUrl] = useState("");
  const [artwork, setArtwork] = useState<Artwork | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<"image" | "text" | null>(null);

  const areas = useMemo(() => safeAreas(product?.printAreas), [product?.printAreas]);
  const selectedArea = areas.find((area) => area.id === selectedAreaId) ?? areas[0] ?? null;
  const productImages = product ? [...new Set([...(product.image ? [product.image] : []), ...product.images])] : [];
  const activeImage = productImages[Math.min(imageIndex, Math.max(productImages.length - 1, 0))];
  const currentPrice = Number(product?.salePrice ?? product?.price ?? 0);

  function invalidateArtwork() {
    setArtwork(null);
    setCompositeUrl("");
  }

  useEffect(() => {
    let active = true;
    async function loadProduct() {
      try {
        setLoading(true);
        const response = await fetch(`/api/custom-print/products/${encodeURIComponent(slug)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Product could not be loaded.");
        if (!active) return;
        const loadedProduct = data.product as Product;
        setProduct(loadedProduct);
        setSelectedColor(loadedProduct.colors[0] ?? "");
        setSelectedAreaId(safeAreas(loadedProduct.printAreas)[0]?.id ?? "");
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load this product.");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (slug) void loadProduct();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!sourceUrl) return;
    return () => URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  useEffect(() => {
    if (!sourceUrl || !selectedArea) return;
    let cancelled = false;
    const image = new window.Image();
    image.onload = () => {
      const width = 1024;
      const ratio = selectedArea.shape === "circle"
        ? 1
        : selectedArea.widthCm / Math.max(selectedArea.heightCm, 0.1);
      const height = Math.max(256, Math.min(2048, Math.round(width / Math.max(ratio, 0.25))));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare the print design preview.");
      if (selectedArea.shape === "circle") {
        context.beginPath();
        context.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
        context.clip();
      }
      const imageWidth = width * 0.4 * imagePoint.scale;
      const imageHeight = imageWidth * (image.height / Math.max(image.width, 1));
      context.save();
      context.translate((imagePoint.x / 100) * width, (imagePoint.y / 100) * height);
      context.rotate((imagePoint.rotation * Math.PI) / 180);
      context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
      context.restore();
      if (text.trim()) {
        context.save();
        context.translate((textPoint.x / 100) * width, (textPoint.y / 100) * height);
        context.rotate((textPoint.rotation * Math.PI) / 180);
        context.fillStyle = textColor;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `bold ${Math.max(20, 52 * textPoint.scale)}px sans-serif`;
        const lines = text.slice(0, 1000).split(/\r?\n/).slice(0, 10);
        lines.forEach((line, index) => context?.fillText(line, 0, index * 64));
        context.restore();
      }
      if (!cancelled) setCompositeUrl(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      if (!cancelled) {
        setMessage("The selected image could not be loaded.");
        setMessageIsError(true);
      }
    };
    image.src = sourceUrl;
    return () => { cancelled = true; };
  }, [sourceUrl, selectedArea, imagePoint, text, textColor, textPoint]);

  function handleImageFile(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setMessage("Choose a JPG, PNG, or WebP image up to 10 MB.");
      setMessageIsError(true);
      return;
    }
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    setImagePoint({ x: 50, y: 50, scale: 1, rotation: 0 });
    invalidateArtwork();
    setMessage("");
    setMessageIsError(false);
  }

  function beginDrag(event: PointerEvent<HTMLElement>, target: "image" | "text") {
    event.preventDefault();
    event.stopPropagation();
    dragging.current = target;
    invalidateArtwork();
    stageRef.current?.setPointerCapture(event.pointerId);
    updateDragPosition(event);
  }

  function updateDragPosition(event: PointerEvent<HTMLElement>) {
    if (!dragging.current || !stageRef.current) return;
    const bounds = stageRef.current.getBoundingClientRect();
    const nextPoint = {
      x: Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
    };
    if (dragging.current === "image") setImagePoint((current) => ({ ...current, ...nextPoint }));
    else setTextPoint((current) => ({ ...current, ...nextPoint }));
  }

  async function saveDesign() {
    if (!product || !selectedArea || !sourceFile || !compositeUrl) {
      setMessage("Choose a print area and upload an image before saving.");
      setMessageIsError(true);
      return;
    }
    setSaving(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const blob = await (await fetch(compositeUrl)).blob();
      const renderedFile = new File([blob], `${product.slug}-design.png`, { type: "image/png" });
      const configuration = {
        elements: [
          { type: "image", ...imagePoint },
          ...(text.trim() ? [{ type: "text", ...textPoint, text: text.slice(0, 1000), color: textColor, fontSize: Math.round(52 * textPoint.scale) }] : []),
        ],
        printArea: { id: selectedArea.id, name: selectedArea.name, surface: selectedArea.surface, shape: selectedArea.shape },
      };
      const upload = new FormData();
      upload.append("file", renderedFile);
      upload.append("originalFile", sourceFile);
      upload.append("productId", product.id);
      upload.append("designConfiguration", JSON.stringify(configuration));
      if (artwork) upload.append("existingId", artwork.id);

      const response = await fetch("/api/customer/custom-print-artwork", { method: "POST", body: upload });
      const data = await response.json();
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/custom-print/${product.slug}`)}`);
        throw new Error("Sign in to save your custom design.");
      }
      if (!response.ok || !data.success) throw new Error(data.message || "Design could not be saved.");
      setArtwork(data.artwork);
      setEditorOpen(false);
      setMessage("Your design is saved and ready for the cart.");
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "Unable to save the design.");
      setMessageIsError(true);
    } finally {
      setSaving(false);
    }
  }

  function addProductToCart(goToCheckout = false) {
    if (!product || !artwork) {
      setMessage("Upload and save your design before adding this product to the cart.");
      setMessageIsError(true);
      return;
    }
    if (product.sizes.length && !selectedSize) {
      setMessage("Choose a size before adding this product to the cart.");
      setMessageIsError(true);
      return;
    }
    const added = addToCart({
      id: product.id,
      productType: "CUSTOM_PRINT",
      name: product.name,
      slug: product.slug,
      image: product.image,
      price: product.price,
      discountPrice: product.salePrice,
      stock: product.stock,
      category: product.category,
    }, quantity, artwork, selectedColor || undefined, selectedSize || undefined);
    if (!added) {
      setMessage(cartReady ? "Unable to add this product to your cart." : "Cart is loading. Try again shortly.");
      setMessageIsError(true);
      return;
    }
    if (goToCheckout) router.push("/checkout");
    else setMessage("Custom product added to your cart.");
  }

  if (loading) return <main className="mx-auto max-w-6xl p-8">Loading product...</main>;
  if (error || !product) return <main className="mx-auto max-w-6xl p-8"><p role="alert" className="rounded-lg bg-red-50 p-5 text-red-800">{error || "Product not found."}</p><Link className="mt-4 inline-block text-blue-700 underline" href="/custom-print">Back to Custom Print products</Link></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="mb-5 text-sm text-slate-500"><Link href="/custom-print" className="text-blue-700">Custom Print</Link> / {product.name}</p>
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-white shadow-sm">
              {activeImage ? <Image src={activeImage} alt={product.name} fill priority sizes="(max-width: 1024px) 100vw, 50vw" unoptimized className="object-contain" /> : <div className="flex h-full items-center justify-center text-slate-400">Product image</div>}
            </div>
            <div className="mt-3 grid grid-cols-6 gap-2">
              {productImages.map((image, index) => (
                <button key={`${image}-${index}`} type="button" onClick={() => setImageIndex(index)} className={`relative aspect-square overflow-hidden rounded-lg border ${index === imageIndex ? "border-blue-600 ring-2 ring-blue-200" : "border-slate-200"}`}>
                  <Image src={image} alt={`${product.name} view ${index + 1}`} fill sizes="100px" unoptimized className="object-cover" />
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm md:p-7">
            <p className="text-sm text-blue-700">{product.category.name} · Product ID: {product.sku}</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">{product.name}</h1>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-2xl font-bold text-slate-900">₹{currentPrice.toFixed(2)}</span>
              {product.salePrice && <span className="text-slate-400 line-through">₹{Number(product.price).toFixed(2)}</span>}
            </div>
            {product.description && <p className="mt-5 whitespace-pre-line text-slate-600">{product.description}</p>}

            {product.colors.length > 0 && <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-semibold">Color</legend>
              <div className="flex flex-wrap gap-2">{product.colors.map((color) => <button key={color} type="button" onClick={() => setSelectedColor(color)} aria-pressed={selectedColor === color} className={`rounded-full border px-4 py-2 text-sm ${selectedColor === color ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300"}`}>{color}</button>)}</div>
            </fieldset>}

            {product.sizes.length > 0 && <label className="mt-5 block text-sm font-semibold">Size
              <select className="mt-2 w-full rounded-lg border p-3 font-normal" value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
                <option value="">Choose a size</option>{product.sizes.map((size) => <option key={size}>{size}</option>)}
              </select>
            </label>}

            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <h2 className="font-semibold text-blue-950">Personalize this product</h2>
              <p className="mt-1 text-sm text-blue-900/80">Upload your image, choose an admin-configured print area, move or resize your design, and add text.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button type="button" disabled={!areas.length} onClick={() => setEditorOpen(true)} className="rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">
                  {artwork ? "Edit your design" : "Upload image & personalize"}
                </button>
                {product.modelUrl && <button type="button" disabled={!artwork || !compositeUrl} onClick={() => setView3DOpen(true)} className="rounded-lg border border-blue-700 px-4 py-3 font-semibold text-blue-800 disabled:opacity-50">View design in 3D · 360°</button>}
              </div>
              {!areas.length && <p className="mt-3 text-sm text-amber-800">Print areas are not configured for this product yet.</p>}
              {artwork && <p className="mt-3 text-sm font-medium text-green-800">Design saved: {artwork.fileName || "custom artwork"}</p>}
            </div>

            <div className="mt-6 flex items-center gap-3">
              <label className="text-sm font-semibold">Qty
                <input type="number" min="1" max={Math.max(product.stock, 1)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(product.stock || 1, Number(event.target.value))))} className="ml-2 w-20 rounded-lg border p-2" />
              </label>
              <span className="text-sm text-slate-500">{product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={!product.stock || !artwork} onClick={() => addProductToCart()} className="rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50">Add to cart</button>
              <button type="button" disabled={!product.stock || !artwork} onClick={() => addProductToCart(true)} className="rounded-lg bg-orange-600 px-4 py-3 font-semibold text-white disabled:opacity-50">Buy now</button>
            </div>
            {message && <p role={messageIsError ? "alert" : "status"} className={`mt-4 rounded-lg p-3 text-sm ${messageIsError ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}>{message}</p>}
          </section>
        </div>
      </div>

      {editorOpen && selectedArea && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 md:p-6" role="dialog" aria-modal="true" aria-labelledby="designer-heading">
        <section className="my-auto w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl md:p-6">
          <header className="flex items-start justify-between gap-4">
            <div><h2 id="designer-heading" className="text-xl font-bold">Design your print area</h2><p className="text-sm text-slate-500">Move the image/text by dragging it. Select the saved print area for this model.</p></div>
            <button type="button" onClick={() => setEditorOpen(false)} aria-label="Close designer" className="rounded-full px-3 py-1 text-2xl leading-none text-slate-500">×</button>
          </header>
          <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <label className="block text-sm font-medium">Choose print area
                <select value={selectedArea.id} onChange={(event) => { setSelectedAreaId(event.target.value); invalidateArtwork(); }} className="mt-1 w-full rounded-lg border p-2">
                  {areas.map((area) => <option key={area.id} value={area.id}>{area.name} ({area.surface})</option>)}
                </select>
              </label>
              <div ref={stageRef} onPointerMove={updateDragPosition} onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }} style={{ aspectRatio: selectedArea.shape === "circle" ? "1" : `${selectedArea.widthCm} / ${selectedArea.heightCm}` }} className={`relative mx-auto mt-4 max-h-[60vh] w-full max-w-[620px] touch-none overflow-hidden border-2 border-dashed border-blue-500 bg-slate-50 ${selectedArea.shape === "circle" ? "rounded-full" : "rounded-xl"}`}>
                {!sourceUrl && <div className="absolute inset-0 flex items-center justify-center p-8 text-center text-slate-400">Upload an image to start designing</div>}
                {sourceUrl && <Image src={sourceUrl} alt="Your uploaded design" width={400} height={400} unoptimized draggable={false} onPointerDown={(event) => beginDrag(event, "image")} style={{ position: "absolute", left: `${imagePoint.x}%`, top: `${imagePoint.y}%`, width: `${40 * imagePoint.scale}%`, height: "auto", maxHeight: "85%", objectFit: "contain", transform: `translate(-50%, -50%) rotate(${imagePoint.rotation}deg)`, cursor: "move", userSelect: "none" }} />}
                {text.trim() && <div onPointerDown={(event) => beginDrag(event, "text")} style={{ position: "absolute", left: `${textPoint.x}%`, top: `${textPoint.y}%`, color: textColor, fontSize: `${2 * textPoint.scale}rem`, transform: `translate(-50%, -50%) rotate(${textPoint.rotation}deg)`, cursor: "move", fontWeight: 700, whiteSpace: "pre-wrap", userSelect: "none" }}>{text.slice(0, 1000)}</div>}
              </div>
              <label className="mt-3 block text-sm">Image size: {imagePoint.scale.toFixed(1)}×
                <input className="w-full accent-blue-700" type="range" min="0.2" max="2.5" step="0.1" value={imagePoint.scale} onChange={(event) => { setImagePoint((current) => ({ ...current, scale: Number(event.target.value) })); invalidateArtwork(); }} />
              </label>
              <label className="block text-sm">Image rotation: {imagePoint.rotation}°
                <input className="w-full accent-blue-700" type="range" min="-180" max="180" step="1" value={imagePoint.rotation} onChange={(event) => { setImagePoint((current) => ({ ...current, rotation: Number(event.target.value) })); invalidateArtwork(); }} />
              </label>
            </div>
            <div className="space-y-4">
              <label className="block rounded-lg border border-dashed p-4 text-center text-sm font-semibold text-blue-700">
                {sourceFile ? "Change image" : "Upload JPG, PNG or WebP"}
                <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => handleImageFile(event.target.files?.[0])} />
                {sourceFile && <span className="mt-1 block truncate text-xs font-normal text-slate-500">{sourceFile.name}</span>}
              </label>
              {product.customizationSettings?.allowText !== false && <>
                <label className="block text-sm font-semibold">Add text
                  <textarea rows={3} maxLength={product.customizationSettings?.maxTextLength ?? 200} value={text} onChange={(event) => { setText(event.target.value); invalidateArtwork(); }} className="mt-1 w-full rounded-lg border p-2 font-normal" placeholder="Type a name or message" />
                </label>
                <label className="block text-sm">Text color
                  <input className="ml-2 h-8 w-12 align-middle" type="color" value={textColor} onChange={(event) => { setTextColor(event.target.value); invalidateArtwork(); }} />
                </label>
                <label className="block text-sm">Text size: {textPoint.scale.toFixed(1)}×
                  <input className="w-full accent-blue-700" type="range" min="0.2" max="2.5" step="0.1" value={textPoint.scale} onChange={(event) => { setTextPoint((current) => ({ ...current, scale: Number(event.target.value) })); invalidateArtwork(); }} />
                </label>
              </>}
              {message && <p role={messageIsError ? "alert" : "status"} className="rounded-md bg-red-50 p-2 text-sm text-red-800">{message}</p>}
              <button type="button" disabled={saving || !sourceFile || !compositeUrl} onClick={saveDesign} className="w-full rounded-lg bg-blue-700 p-3 font-semibold text-white disabled:opacity-50">{saving ? "Saving design..." : "Save design"}</button>
            </div>
          </div>
        </section>
      </div>}

      {view3DOpen && selectedArea && product.modelUrl && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3 md:p-8" role="dialog" aria-modal="true" aria-label="360 degree product preview">
        <section className="w-full max-w-5xl rounded-2xl bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className="text-xl font-bold">360° design preview</h2><p className="text-sm text-slate-500">Drag to rotate · Scroll to zoom</p></div>
            <button type="button" onClick={() => setView3DOpen(false)} aria-label="Close 3D preview" className="rounded-full px-3 py-1 text-2xl text-slate-500">×</button>
          </div>
          <CustomPrint3DViewer key={product.id} modelUrl={product.modelUrl} height={Math.min(650, typeof window === "undefined" ? 600 : window.innerHeight - 160)} autoRotate
            printArea={selectedArea}
            designSettings={{ imageUrl: compositeUrl }} />
        </section>
      </div>}
    </main>
  );
}
