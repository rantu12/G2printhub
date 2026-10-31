"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

const CustomPrint3DViewer = dynamic(
  () => import("@/components/custom-print/CustomPrint3DViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center rounded-lg bg-slate-200">
        3D viewer loading...
      </div>
    ),
  }
);

type PrintArea = {
  shape: "rectangle" | "circle";
  diameterCm?: number;
  widthCm: number;
  heightCm: number;
  x: number;
  y: number;
  rotation: number;
  verticalPosition: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  printAreas?: unknown;
  customizationSettings?: unknown;
};

function getModelUrl(product?: Product): string {
  if (!product?.customizationSettings) return "";
  const settings = product.customizationSettings;
  if (typeof settings !== "object" || settings === null || Array.isArray(settings)) return "";
  const modelUrl = (settings as Record<string, unknown>).modelUrl;
  return typeof modelUrl === "string" ? modelUrl : "";
}

function readSavedArea(product?: Product): PrintArea | null {
  const areas = product?.printAreas;
  if (!Array.isArray(areas) || !areas.length) return null;
  const area = areas[0];
  if (!area || typeof area !== "object") return null;
  const item = area as Partial<PrintArea>;
  const shape = item.shape === "circle" ? "circle" : "rectangle";
  const diameterCm = Number(item.diameterCm) || Number(item.widthCm) || Number(item.heightCm) || 9;
  return {
    shape,
    diameterCm,
    widthCm: shape === "circle" ? diameterCm : Number(item.widthCm) || 11,
    heightCm: shape === "circle" ? diameterCm : Number(item.heightCm) || 6.5,
    x: Number(item.x) || 0,
    y: Number(item.y) || 0,
    rotation: Number(item.rotation) || 0,
    verticalPosition: item.verticalPosition || "center",
  };
}

type EditorProps = {
  shape: PrintArea["shape"];
  width: number;
  height: number;
  x: number;
  y: number;
  setShape: (value: PrintArea["shape"]) => void;
  setWidth: (value: number) => void;
  setHeight: (value: number) => void;
  setX: (value: number) => void;
  setY: (value: number) => void;
};

type DragState = {
  kind: "move" | "nw" | "ne" | "sw" | "se";
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  startXOffset: number;
  startYOffset: number;
};

function PrintAreaEditor({
  shape,
  width,
  height,
  x,
  y,
  setShape,
  setWidth,
  setHeight,
  setX,
  setY,
}: EditorProps) {
  const [drag, setDrag] = useState<DragState | null>(null);

  // Scale the editor box to the same relative width/height range as the controls.
  const boxWidth = shape === "circle"
    ? Math.max(8, Math.min(62, (width / 3.0) * 68 * (240 / 260)))
    : Math.max(8, Math.min(78, (width / 2.5) * 78));
  const boxHeight = shape === "circle"
    ? Math.max(8, Math.min(68, (width / 3.0) * 68))
    : Math.max(8, Math.min(68, (height / 3.0) * 68));
  const left = Math.max(8, Math.min(92 - boxWidth, 50 + x * 35 - boxWidth / 2));
  const top = Math.max(10, Math.min(90 - boxHeight, 50 - y * 30 - boxHeight / 2));

  function beginDrag(
    event: React.PointerEvent<HTMLDivElement>,
    kind: DragState["kind"],
  ) {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLDivElement).setPointerCapture?.(event.pointerId);
    setDrag({
      kind,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: width,
      startHeight: height,
      startXOffset: x,
      startYOffset: y,
    });
  }

  function onDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    event.preventDefault();

    const dx = ((event.clientX - drag.startX) / 260) * 2.4;
    const dy = ((event.clientY - drag.startY) / 170) * 2.9;

    if (drag.kind === "move") {
      setX(Math.max(-0.5, Math.min(0.5, drag.startXOffset + dx)));
      setY(Math.max(-0.6, Math.min(0.6, drag.startYOffset - dy)));
      return;
    }

    const growsRight = drag.kind === "ne" || drag.kind === "se";
    const growsDown = drag.kind === "sw" || drag.kind === "se";
    const widthDelta = growsRight ? dx : -dx;
    const heightDelta = growsDown ? dy : -dy;

    if (shape === "circle") {
      const diameterDelta = Math.abs(widthDelta) >= Math.abs(heightDelta) ? widthDelta : heightDelta;
      const diameter = Math.max(0.1, Math.min(2.5, drag.startWidth + diameterDelta));
      setWidth(diameter);
      setHeight(diameter);
      return;
    }
    setWidth(Math.max(0.1, Math.min(2.5, drag.startWidth + widthDelta)));
    setHeight(Math.max(0.1, Math.min(3.0, drag.startHeight + heightDelta)));
  }

  const handleClass =
    "absolute z-20 h-4 w-4 rounded-full border-2 border-white bg-sky-500 shadow";

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-slate-800">Print Area Editor</h3>
        <p className="mt-1 text-xs text-slate-500">
          Area-র ভেতরে drag করলে অবস্থান বদলাবে। নীল handle drag করে size বদলাও।
        </p>
      </div>

      <div className="flex gap-2" role="group" aria-label="Print area shape">
        <button type="button" aria-pressed={shape === "rectangle"}
          onClick={() => setShape("rectangle")}
          className={`rounded-md border px-3 py-2 text-sm ${shape === "rectangle" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}>
          Rectangle
        </button>
        <button type="button" aria-pressed={shape === "circle"}
          onClick={() => {
            setShape("circle");
            setHeight(width);
          }}
          className={`rounded-md border px-3 py-2 text-sm ${shape === "circle" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-300 text-slate-600"}`}>
          Round
        </button>
      </div>

      <div
        className="relative h-60 touch-none select-none overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-b from-slate-100 to-slate-300"
        onPointerMove={onDrag}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onLostPointerCapture={() => setDrag(null)}
      >
        {/* Visual guide only; the real product remains in the 3D preview beside this editor. */}
        <div className="absolute bottom-2 left-1/2 top-5 w-[58%] -translate-x-1/2 rounded-[42%_42%_12%_12%] border border-yellow-700/20 bg-gradient-to-r from-yellow-600 via-yellow-300 to-yellow-600 shadow-inner">
          <div className="absolute -top-4 left-[29%] h-6 w-[42%] rounded-t-full border border-slate-400/50 bg-slate-500" />
        </div>

        <div
          className={`absolute cursor-move border-2 border-dashed border-red-600 bg-red-400/35 ${shape === "circle" ? "rounded-full" : ""}`}
          style={{
            left: `${left}%`,
            top: `${top}%`,
            width: `${boxWidth}%`,
            height: `${boxHeight}%`,
          }}
          onPointerDown={(event) => beginDrag(event, "move")}
        >
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-bold text-red-800">
            PRINT AREA
          </span>

          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <div
              key={corner}
              className={`${handleClass} ${
                corner === "nw"
                  ? "-left-2 -top-2 cursor-nwse-resize"
                  : corner === "ne"
                    ? "-right-2 -top-2 cursor-nesw-resize"
                    : corner === "sw"
                      ? "-bottom-2 -left-2 cursor-nesw-resize"
                      : "-bottom-2 -right-2 cursor-nwse-resize"
              }`}
              onPointerDown={(event) => beginDrag(event, corner)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {shape === "circle" ? (
          <label className="col-span-2 block">
            Diameter: {(width * 100).toFixed(0)} mm
            <input className="mt-1 w-full accent-blue-600" type="range" min="0.1" max="2.5" step="0.01" value={width}
              onChange={(event) => {
                const diameter = Number(event.target.value);
                setWidth(diameter);
                setHeight(diameter);
              }} />
          </label>
        ) : (
          <>
            <label className="block">
              Width: {(width * 100).toFixed(0)} mm
              <input className="mt-1 w-full accent-blue-600" type="range" min="0.1" max="2.5" step="0.01" value={width}
                onChange={(event) => setWidth(Number(event.target.value))} />
            </label>
            <label className="block">
              Height: {(height * 100).toFixed(0)} mm
              <input className="mt-1 w-full accent-blue-600" type="range" min="0.1" max="3.0" step="0.01" value={height}
                onChange={(event) => setHeight(Number(event.target.value))} />
            </label>
          </>
        )}
        <label className="block">
          Horizontal Position: {x.toFixed(2)}
          <input className="mt-1 w-full accent-blue-600" type="range" min="-0.5" max="0.5" step="0.025" value={x}
            onChange={(event) => setX(Number(event.target.value))} />
        </label>
        <label className="block">
          Vertical Position: {y.toFixed(2)}
          <input className="mt-1 w-full accent-blue-600" type="range" min="-0.6" max="0.6" step="0.025" value={y}
            onChange={(event) => setY(Number(event.target.value))} />
        </label>
      </div>
    </div>
  );
}

export default function AdminCustomPrintPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [width, setWidth] = useState(1.1);
  const [height, setHeight] = useState(0.65);
  const [shape, setShape] = useState<PrintArea["shape"]>("rectangle");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [uploadingModel, setUploadingModel] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadProducts() {
      try {
        setLoading(true);
        const response = await fetch("/api/admin/custom-print/products", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Products load করা যায়নি।");
        const items: Product[] = Array.isArray(data.products) ? data.products : [];
        if (!cancelled) {
          setProducts(items);
          setProductId((current) => current && items.some((product) => product.id === current) ? current : (items[0]?.id || ""));
          setMessage(items.length ? "" : "কোনো product পাওয়া যায়নি। আগে product তৈরি করো।");
        }
      } catch (error) {
        if (!cancelled) setMessage(error instanceof Error ? error.message : "Products load করতে সমস্যা হয়েছে।");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadProducts();
    return () => { cancelled = true; };
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId),
    [products, productId],
  );
  const modelUrl = getModelUrl(selectedProduct);

  useEffect(() => {
    const saved = readSavedArea(selectedProduct);
    if (!saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidth(1.1);
      setHeight(0.65);
      setShape("rectangle");
      setX(0);
      setY(0);
      setRotation(0);
      return;
    }
    setShape(saved.shape);
    setWidth(saved.widthCm / 10);
    setHeight(saved.heightCm / 10);
    setX(saved.x);
    setY(saved.y);
    setRotation(saved.rotation);
  }, [selectedProduct]);

  async function uploadModel() {
    if (!productId || !selectedProduct) {
      setMessage("আগে একটি product নির্বাচন করো।");
      return;
    }
    if (!modelFile) {
      setMessage("আগে একটি .glb file নির্বাচন করো।");
      return;
    }
    if (!modelFile.name.toLowerCase().endsWith(".glb")) {
      setMessage("শুধু .glb file upload করা যাবে।");
      return;
    }

    try {
      setUploadingModel(true);
      setMessage("");
      const formData = new FormData();
      formData.append("model", modelFile);
      const uploadResponse = await fetch("/api/admin/custom-print/products/upload-model", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok || !uploadData.success || !uploadData.modelUrl) {
        throw new Error(uploadData.message || "GLB upload failed.");
      }

      const oldSettings =
        selectedProduct.customizationSettings &&
        typeof selectedProduct.customizationSettings === "object" &&
        !Array.isArray(selectedProduct.customizationSettings)
          ? selectedProduct.customizationSettings as Record<string, unknown>
          : {};
      const newSettings = { ...oldSettings, modelUrl: uploadData.modelUrl };

      const saveResponse = await fetch("/api/admin/custom-print/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, customizationSettings: newSettings }),
      });
      const saveData = await saveResponse.json();
      if (!saveResponse.ok || !saveData.success) {
        throw new Error(saveData.message || "Model uploaded, but saving it to the product failed.");
      }

      setProducts((current) => current.map((product) =>
        product.id === productId ? { ...product, customizationSettings: newSettings } : product
      ));
      setModelFile(null);
      setMessage("GLB model upload ও product settings save সফল হয়েছে।");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GLB upload failed.");
    } finally {
      setUploadingModel(false);
    }
  }

  async function saveArea() {
    if (!productId) {
      setMessage("আগে একটি product নির্বাচন করো।");
      return;
    }

    const printArea: PrintArea = {
      shape,
      ...(shape === "circle" ? { diameterCm: Number((width * 10).toFixed(2)) } : {}),
      widthCm: Number((width * 10).toFixed(2)),
      heightCm: Number(((shape === "circle" ? width : height) * 10).toFixed(2)),
      x,
      y,
      rotation,
      verticalPosition: "center",
    };

    try {
      setSaving(true);
      setMessage("");
      const response = await fetch("/api/admin/custom-print/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, printAreas: [printArea] }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Print Area save করা যায়নি।");

      setProducts((current) => current.map((product) =>
        product.id === productId ? { ...product, printAreas: [printArea] } : product
      ));
      setMessage("Print Area সফলভাবে save হয়েছে।");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save করতে সমস্যা হয়েছে।");
    } finally {
      setSaving(false);
    }
  }

  const buttonClass = "w-full rounded-lg p-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <header className="mb-5 rounded-xl bg-blue-800 p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin Panel — Custom Print Area</h1>
            <p className="mt-1 text-sm text-blue-100">Legacy product-area setup. Configure reusable templates in the 3D Model Library.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/admin/custom-print/models" className="rounded-lg bg-white px-4 py-2 font-semibold text-blue-800">3D Model Library</a>
            <a href="/admin/custom-print/products/new" className="rounded-lg border border-white/60 px-4 py-2 font-semibold text-white">Create product</a>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
        <section className="min-w-0 rounded-xl bg-white p-5 shadow">
          <div className="mb-5">
            <label htmlFor="product-select" className="block text-sm font-semibold">Product</label>
            <select id="product-select" suppressHydrationWarning disabled={Boolean(loading || products.length === 0)} className="mt-2 w-full rounded-lg border p-3" value={productId}
              onChange={(event) => { setProductId(event.target.value); setMessage(""); }}>
              {products.length === 0 && <option value="">No products found</option>}
              {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </select>
          </div>

          <div className="mb-5 space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <h2 className="font-semibold text-slate-800">Upload 3D Product Model</h2>
            <p className="text-sm text-slate-600">কম্পিউটার থেকে product-এর .glb file নির্বাচন করে upload করো।</p>
            <input type="file" accept=".glb,model/gltf-binary"
              onChange={(event) => { setModelFile(event.target.files?.[0] || null); setMessage(""); }}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold" />
            {modelFile && <p className="break-all text-xs text-slate-600">Selected: {modelFile.name}</p>}
            <button type="button" onClick={uploadModel} disabled={uploadingModel || !modelFile || !productId}
              className={`${buttonClass} bg-indigo-600 hover:bg-indigo-700`}>
              {uploadingModel ? "Uploading model..." : "Upload GLB Model"}
            </button>
            {modelUrl && <p className="break-all text-xs text-green-700">Existing model: {modelUrl}</p>}
          </div>

          <div className="max-h-[65vh] space-y-5 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 p-4 pr-3">
            <PrintAreaEditor shape={shape} width={width} height={height} x={x} y={y}
              setShape={setShape} setWidth={setWidth} setHeight={setHeight} setX={setX} setY={setY} />

            <label className="block text-sm">
              Rotation: {rotation}°
              <input className="mt-2 w-full accent-blue-600" type="range" min="-180" max="180" step="1" value={rotation}
                onChange={(event) => setRotation(Number(event.target.value))} />
            </label>

            <button type="button" onClick={saveArea} disabled={saving || loading || !productId}
              className={`${buttonClass} bg-blue-600 hover:bg-blue-700`}>
              {saving ? "Saving..." : "Save Print Area"}
            </button>
          </div>

          {message && <p role="status" className="mt-4 break-words text-sm text-blue-700">{message}</p>}
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl bg-white p-3 shadow">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">3D Product Preview</h2>
            <span className="text-xs text-slate-500">Drag to rotate · Scroll to zoom</span>
          </div>
          {loading ? (
            <div className="flex h-[480px] items-center justify-center rounded-lg bg-slate-200">Products loading...</div>
          ) : !selectedProduct ? (
            <div className="flex h-[480px] items-center justify-center rounded-lg bg-slate-100 p-6 text-center text-slate-600">
              কোনো product পাওয়া যায়নি। আগে একটি product তৈরি করো।
            </div>
          ) : modelUrl ? (
            <CustomPrint3DViewer modelUrl={modelUrl} height={480}
              printArea={{ shape, widthCm: width * 10, heightCm: (shape === "circle" ? width : height) * 10, x, y, rotation }} />
          ) : (
            <div className="flex h-[480px] flex-col items-center justify-center gap-3 rounded-lg bg-slate-100 p-6 text-center">
              <p className="font-semibold text-slate-700">এই product-এর GLB model URL পাওয়া যায়নি।</p>
              <p className="max-w-lg text-sm text-slate-500">এই product-এর customizationSettings.modelUrl সঠিকভাবে সেট করো।</p>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-dashed border-red-300 bg-red-50 p-4">
            <h3 className="font-semibold text-slate-800">Print Area Settings Summary</h3>
            <p className="mt-2 text-sm text-slate-600">Shape: {shape === "circle" ? "Round" : "Rectangle"}</p>
            <p className="text-sm text-slate-600">Width: {(width * 100).toFixed(0)} mm</p>
            <p className="text-sm text-slate-600">Height: {(height * 100).toFixed(0)} mm</p>
            <p className="text-sm text-slate-600">X: {x.toFixed(2)} · Y: {y.toFixed(2)} · Rotation: {rotation}°</p>
            <p className="mt-2 text-xs text-slate-500">
              3D model-এর গায়ে print area বসাতে preview-র model surface-এ click করো; drag করে ঘোরানো যাবে।
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
