"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { fetchAdmin } from "@/lib/admin-fetch";

const CustomPrint3DViewer = dynamic(
  () => import("@/components/custom-print/CustomPrint3DViewer"),
  { ssr: false, loading: () => <div className="flex h-[520px] items-center justify-center rounded-xl bg-slate-200">3D viewer loading...</div> }
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

type Model = {
  id: string;
  name: string;
  modelType: string;
  modelUrl: string;
  printAreas: PrintArea[] | null;
  active: boolean;
  _count?: { products: number };
};

const newArea = (): PrintArea => ({
  id: crypto.randomUUID(),
  name: "Front print",
  surface: "front",
  shape: "rectangle",
  widthCm: 12,
  heightCm: 8,
  x: 0,
  y: 0,
  rotation: 0,
});

export default function CustomPrintModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [modelType, setModelType] = useState("");
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [areas, setAreas] = useState<PrintArea[]>([]);
  const [areaId, setAreaId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedId),
    [models, selectedId]
  );
  const selectedArea = areas.find((area) => area.id === areaId) ?? null;

  async function loadModels(preferredId?: string) {
    try {
      const response = await fetchAdmin("/api/admin/custom-print/models", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "3D models could not be loaded.");
      const nextModels = data.models as Model[];
      setModels(nextModels);
      const nextId = preferredId && nextModels.some((model) => model.id === preferredId)
        ? preferredId
        : nextModels[0]?.id ?? "";
      const nextModel = nextModels.find((model) => model.id === nextId);
      setSelectedId(nextId);
      setAreas(Array.isArray(nextModel?.printAreas) ? nextModel.printAreas : []);
      setAreaId(nextModel?.printAreas?.[0]?.id ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load 3D models.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadModels();
  }, []);

  function selectModel(model: Model) {
    setSelectedId(model.id);
    setAreas(Array.isArray(model.printAreas) ? model.printAreas : []);
    setAreaId(model.printAreas?.[0]?.id ?? "");
  }

  async function createModel() {
    if (!name.trim() || !modelType.trim() || !modelFile) {
      setMessage("Model name, type and a GLB file are required.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const uploadResponse = await fetchAdmin("/api/admin/custom-print/products/upload-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: modelFile.name, fileSize: modelFile.size }),
      });
      const uploadData = await uploadResponse.json();
      if (
        !uploadResponse.ok ||
        !uploadData.success ||
        typeof uploadData.uploadUrl !== "string" ||
        typeof uploadData.modelUrl !== "string"
      ) {
        throw new Error(uploadData.message || "Model upload could not be prepared.");
      }

      const storageResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "model/gltf-binary" },
        body: modelFile,
      });
      if (!storageResponse.ok) {
        throw new Error("The GLB could not be uploaded to Neon Object Storage.");
      }

      const response = await fetchAdmin("/api/admin/custom-print/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), modelType: modelType.trim(), modelUrl: uploadData.modelUrl, printAreas: [] }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Model could not be saved.");
      setName("");
      setModelType("");
      setModelFile(null);
      await loadModels(data.model.id);
      setMessage("3D model added. Add print areas by selecting the model surface.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the model.");
    } finally {
      setBusy(false);
    }
  }

  function updateArea<K extends keyof PrintArea>(key: K, value: PrintArea[K]) {
    if (!selectedArea) return;
    setAreas((current) => current.map((area) => area.id === selectedArea.id ? { ...area, [key]: value } : area));
  }

  function addArea() {
    const area = newArea();
    setAreas((current) => [...current, area]);
    setAreaId(area.id);
  }

  async function saveAreas() {
    if (!selectedModel) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetchAdmin("/api/admin/custom-print/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedModel.id, printAreas: areas }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Print areas could not be saved.");
      setModels((current) => current.map((model) => model.id === data.model.id ? data.model : model));
      setMessage("Model print areas saved. You can now assign this model to products.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save print areas.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (!selectedModel) return;
    setBusy(true);
    try {
      const response = await fetchAdmin("/api/admin/custom-print/models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedModel.id, active: !selectedModel.active }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Model status could not be changed.");
      setModels((current) => current.map((model) => model.id === data.model.id ? data.model : model));
      setMessage(data.model.active ? "Model activated." : "Model archived; existing products remain linked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to change model status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blue-800 p-5 text-white">
        <div>
          <h1 className="text-2xl font-bold">3D Model Library</h1>
          <p className="mt-1 text-sm text-blue-100">Upload reusable mug, cap, cup, bottle, T-shirt, clock, frame and other product models.</p>
        </div>
        <a href="/admin/custom-print/products/new" className="rounded-lg bg-white px-4 py-2 font-semibold text-blue-800">Create product</a>
      </header>

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="space-y-3 rounded-xl bg-white p-5 shadow">
            <h2 className="font-semibold">Add a reusable 3D model</h2>
            <label className="block text-sm">Model name
              <input className="mt-1 w-full rounded-md border p-2" value={name} onChange={(event) => setName(event.target.value)} placeholder="Classic ceramic mug" />
            </label>
            <label className="block text-sm">Model type
              <input className="mt-1 w-full rounded-md border p-2" value={modelType} onChange={(event) => setModelType(event.target.value)} placeholder="Mug, cap, bottle, T-shirt..." />
            </label>
            <label className="block text-sm">GLB model
              <input className="mt-1 block w-full text-sm" type="file" accept=".glb,model/gltf-binary" onChange={(event) => setModelFile(event.target.files?.[0] ?? null)} />
            </label>
            <button type="button" onClick={createModel} disabled={busy || !modelFile} className="w-full rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-50">
              {busy ? "Saving..." : "Upload model"}
            </button>
          </section>

          <section className="rounded-xl bg-white p-5 shadow">
            <h2 className="mb-3 font-semibold">Saved model templates</h2>
            {loading ? <p className="text-sm text-slate-500">Loading models...</p> : models.length === 0 ? <p className="text-sm text-slate-500">No models yet.</p> : (
              <div className="space-y-2">
                {models.map((model) => (
                  <button type="button" key={model.id} onClick={() => selectModel(model)}
                    className={`w-full rounded-lg border p-3 text-left ${selectedId === model.id ? "border-blue-600 bg-blue-50" : "border-slate-200"}`}>
                    <span className="block font-medium">{model.name}</span>
                    <span className="text-xs text-slate-500">{model.modelType} · {model._count?.products ?? 0} product(s){!model.active ? " · archived" : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
          {message && <p role="status" className="rounded-lg bg-white p-3 text-sm text-blue-800 shadow">{message}</p>}
        </aside>

        <section className="min-w-0 space-y-4 rounded-xl bg-white p-4 shadow">
          {!selectedModel ? <div className="flex min-h-[520px] items-center justify-center text-slate-500">Add or select a model to configure its print areas.</div> : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{selectedModel.name} — print areas</h2>
                  <p className="text-sm text-slate-500">Add each print area, then click the matching surface on the 3D model to anchor it.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={addArea} className="rounded-lg border border-blue-600 px-3 py-2 text-sm font-semibold text-blue-700">Add area</button>
                  <button type="button" onClick={toggleActive} disabled={busy} className="rounded-lg border px-3 py-2 text-sm">{selectedModel.active ? "Archive model" : "Activate model"}</button>
                  <button type="button" onClick={saveAreas} disabled={busy} className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white">{busy ? "Saving..." : "Save areas"}</button>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <label className="block text-sm">Print area
                    <select className="mt-1 w-full rounded-md border p-2" value={areaId} onChange={(event) => setAreaId(event.target.value)}>
                      <option value="">Select area</option>
                      {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                  </label>
                  {selectedArea && (
                    <>
                      <label className="block text-sm">Area name
                        <input className="mt-1 w-full rounded-md border p-2" value={selectedArea.name} onChange={(event) => updateArea("name", event.target.value)} />
                      </label>
                      <label className="block text-sm">Surface label
                        <select className="mt-1 w-full rounded-md border p-2" value={selectedArea.surface} onChange={(event) => updateArea("surface", event.target.value)}>
                          {["front", "back", "left", "right", "top", "custom"].map((surface) => <option key={surface} value={surface}>{surface}</option>)}
                        </select>
                      </label>
                      <div className="flex gap-2">
                        {(["rectangle", "circle"] as const).map((shape) => (
                          <button key={shape} type="button" aria-pressed={selectedArea.shape === shape} onClick={() => {
                            setAreas((current) => current.map((area) => area.id === selectedArea.id
                              ? { ...area, shape, ...(shape === "circle" ? { heightCm: area.widthCm } : {}) }
                              : area));
                          }} className={`rounded-md border px-3 py-2 text-sm ${selectedArea.shape === shape ? "border-blue-600 bg-blue-50" : ""}`}>{shape}</button>
                        ))}
                      </div>
                      <label className="block text-sm">{selectedArea.shape === "circle" ? "Diameter" : "Width"} (cm): {selectedArea.widthCm}
                        <input className="w-full accent-blue-600" type="range" min="0.1" max="25" step="0.1" value={selectedArea.widthCm} onChange={(event) => {
                          const widthCm = Number(event.target.value);
                          setAreas((current) => current.map((area) => area.id === selectedArea.id
                            ? { ...area, widthCm, ...(area.shape === "circle" ? { heightCm: widthCm } : {}) }
                            : area));
                        }} />
                      </label>
                      {selectedArea.shape !== "circle" && <label className="block text-sm">Height (cm): {selectedArea.heightCm}
                        <input className="w-full accent-blue-600" type="range" min="0.1" max="30" step="0.1" value={selectedArea.heightCm} onChange={(event) => updateArea("heightCm", Number(event.target.value))} />
                      </label>}
                      <label className="block text-sm">Horizontal offset: {selectedArea.x.toFixed(2)}
                        <input className="w-full accent-blue-600" type="range" min="-0.5" max="0.5" step="0.01" value={selectedArea.x} onChange={(event) => updateArea("x", Number(event.target.value))} />
                      </label>
                      <label className="block text-sm">Vertical offset: {selectedArea.y.toFixed(2)}
                        <input className="w-full accent-blue-600" type="range" min="-0.6" max="0.6" step="0.01" value={selectedArea.y} onChange={(event) => updateArea("y", Number(event.target.value))} />
                      </label>
                      <label className="block text-sm">Rotation: {selectedArea.rotation}°
                        <input className="w-full accent-blue-600" type="range" min="-180" max="180" step="1" value={selectedArea.rotation} onChange={(event) => updateArea("rotation", Number(event.target.value))} />
                      </label>
                      <p className="text-xs text-slate-500">{selectedArea.anchor ? `Anchored to ${selectedArea.anchor.meshName || "selected surface"}.` : "Click the model surface to set the print-area anchor."}</p>
                      <button type="button" onClick={() => {
                        setAreas((current) => current.filter((area) => area.id !== selectedArea.id));
                        const remaining = areas.filter((area) => area.id !== selectedArea.id);
                        setAreaId(remaining[0]?.id ?? "");
                      }} className="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700">Remove area</button>
                    </>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={autoRotate} onChange={(event) => setAutoRotate(event.target.checked)} />
                    360° preview
                  </label>
                </div>
                <div className="overflow-hidden rounded-xl border bg-slate-100">
                  <CustomPrint3DViewer
                    key={selectedModel.id}
                    modelUrl={selectedModel.modelUrl}
                    height={520}
                    autoRotate={autoRotate}
                    printArea={selectedArea ? { ...selectedArea, ...(selectedArea.shape === "circle" ? { diameterCm: selectedArea.widthCm } : {}) } : null}
                    onSurfacePick={(anchor) => selectedArea && updateArea("anchor", anchor)}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
