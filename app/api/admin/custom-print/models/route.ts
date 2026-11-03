import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createNeonModelPreviewUrl,
  getModelPreviewUrl,
  isNeonModelObjectKey,
  verifyNeonModelObject,
} from "@/lib/neon-object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ModelArea = {
  id: string;
  name: string;
  surface: string;
  shape: "rectangle" | "circle";
  widthCm: number;
  heightCm: number;
  x: number;
  y: number;
  rotation: number;
  anchor?: {
    point: [number, number, number];
    normal: [number, number, number];
    meshName?: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validModelUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  if (isNeonModelObjectKey(value)) return true;
  if (value.startsWith("/uploads/custom-print/models/")) {
    return /\.glb$/i.test(value) && !value.includes("\\") && !value.includes("..");
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /\.glb$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function parseAreas(value: unknown): ModelArea[] | null {
  if (!Array.isArray(value) || value.length > 20) return null;
  const areas: ModelArea[] = [];
  const ids = new Set<string>();

  for (const candidate of value) {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== "string" ||
      !candidate.id.trim() ||
      candidate.id.length > 100 ||
      ids.has(candidate.id) ||
      typeof candidate.name !== "string" ||
      !candidate.name.trim() ||
      candidate.name.length > 100 ||
      typeof candidate.surface !== "string" ||
      !candidate.surface.trim() ||
      candidate.surface.length > 100 ||
      (candidate.shape !== "rectangle" && candidate.shape !== "circle") ||
      typeof candidate.widthCm !== "number" ||
      !Number.isFinite(candidate.widthCm) ||
      candidate.widthCm < 0.1 ||
      candidate.widthCm > 250 ||
      typeof candidate.heightCm !== "number" ||
      !Number.isFinite(candidate.heightCm) ||
      candidate.heightCm < 0.1 ||
      candidate.heightCm > 300 ||
      typeof candidate.x !== "number" ||
      !Number.isFinite(candidate.x) ||
      candidate.x < -0.5 ||
      candidate.x > 0.5 ||
      typeof candidate.y !== "number" ||
      !Number.isFinite(candidate.y) ||
      candidate.y < -0.6 ||
      candidate.y > 0.6 ||
      typeof candidate.rotation !== "number" ||
      !Number.isFinite(candidate.rotation) ||
      candidate.rotation < -180 ||
      candidate.rotation > 180
    ) {
      return null;
    }

    let anchor: ModelArea["anchor"];
    if (candidate.anchor !== undefined) {
      if (
        !isRecord(candidate.anchor) ||
        !Array.isArray(candidate.anchor.point) ||
        !Array.isArray(candidate.anchor.normal) ||
        candidate.anchor.point.length !== 3 ||
        candidate.anchor.normal.length !== 3 ||
        [...candidate.anchor.point, ...candidate.anchor.normal].some(
          (coordinate) => typeof coordinate !== "number" || !Number.isFinite(coordinate)
        ) ||
        (candidate.anchor.meshName !== undefined &&
          (typeof candidate.anchor.meshName !== "string" ||
            candidate.anchor.meshName.length > 200))
      ) {
        return null;
      }
      anchor = {
        point: candidate.anchor.point as [number, number, number],
        normal: candidate.anchor.normal as [number, number, number],
        ...(typeof candidate.anchor.meshName === "string"
          ? { meshName: candidate.anchor.meshName }
          : {}),
      };
    }

    ids.add(candidate.id);
    areas.push({
      id: candidate.id,
      name: candidate.name.trim(),
      surface: candidate.surface.trim(),
      shape: candidate.shape,
      widthCm: candidate.widthCm,
      heightCm: candidate.heightCm,
      x: candidate.x,
      y: candidate.y,
      rotation: candidate.rotation,
      ...(anchor ? { anchor } : {}),
    });
  }
  return areas;
}

function adminError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "UNAUTHORIZED") {
    return NextResponse.json({ success: false, message: "Please log in first." }, { status: 401 });
  }
  if (message === "FORBIDDEN") {
    return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
  }
  if (message === "NEON_OBJECT_STORAGE_ENV_MISSING") {
    return NextResponse.json(
      { success: false, message: "Neon Object Storage is not configured for this environment." },
      { status: 503 }
    );
  }
  console.error("Custom Print model API error:", error);
  return NextResponse.json({ success: false, message: "Unable to process 3D models." }, { status: 500 });
}

async function modelForResponse<T extends { modelUrl: string }>(model: T) {
  return {
    ...model,
    modelUrl: isNeonModelObjectKey(model.modelUrl)
      ? await createNeonModelPreviewUrl(model.modelUrl)
      : await getModelPreviewUrl(model.modelUrl),
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const models = await prisma.customPrintModel.findMany({
      orderBy: [{ modelType: "asc" }, { createdAt: "desc" }],
      include: { _count: { select: { products: true } } },
    });
    const modelsWithPreviewUrls = await Promise.all(models.map(modelForResponse));
    return NextResponse.json({ success: true, models: modelsWithPreviewUrls });
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();
    if (
      !isRecord(body) ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.length > 120 ||
      typeof body.modelType !== "string" ||
      !body.modelType.trim() ||
      body.modelType.length > 80 ||
      !validModelUrl(body.modelUrl)
    ) {
      return NextResponse.json({ success: false, message: "Enter a name, model type and valid GLB model." }, { status: 400 });
    }
    const printAreas = parseAreas(body.printAreas ?? []);
    if (!printAreas) {
      return NextResponse.json({ success: false, message: "Print areas contain invalid or duplicate values." }, { status: 400 });
    }
    if (isNeonModelObjectKey(body.modelUrl)) {
      try {
        await verifyNeonModelObject(body.modelUrl);
      } catch (error) {
        if (error instanceof Error && error.message === "INVALID_NEON_MODEL_FILE") {
          return NextResponse.json({ success: false, message: "The uploaded file is not a valid GLB model." }, { status: 400 });
        }
        throw error;
      }
    }

    const model = await prisma.customPrintModel.create({
      data: {
        name: body.name.trim(),
        modelType: body.modelType.trim(),
        modelUrl: body.modelUrl,
        printAreas,
        active: body.active !== false,
      },
    });
    return NextResponse.json({ success: true, model: await modelForResponse(model) }, { status: 201 });
  } catch (error) {
    return adminError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();
    if (!isRecord(body) || typeof body.id !== "string" || !body.id.trim()) {
      return NextResponse.json({ success: false, message: "Model ID is required." }, { status: 400 });
    }
    const current = await prisma.customPrintModel.findUnique({ where: { id: body.id.trim() } });
    if (!current) {
      return NextResponse.json({ success: false, message: "3D model not found." }, { status: 404 });
    }
    if (
      (body.name !== undefined && (typeof body.name !== "string" || !body.name.trim() || body.name.length > 120)) ||
      (body.modelType !== undefined && (typeof body.modelType !== "string" || !body.modelType.trim() || body.modelType.length > 80)) ||
      (body.modelUrl !== undefined && !validModelUrl(body.modelUrl)) ||
      (body.active !== undefined && typeof body.active !== "boolean")
    ) {
      return NextResponse.json({ success: false, message: "Invalid 3D model details." }, { status: 400 });
    }
    const printAreas = body.printAreas === undefined ? undefined : parseAreas(body.printAreas);
    if (body.printAreas !== undefined && !printAreas) {
      return NextResponse.json({ success: false, message: "Print areas contain invalid or duplicate values." }, { status: 400 });
    }
    if (typeof body.modelUrl === "string" && isNeonModelObjectKey(body.modelUrl)) {
      try {
        await verifyNeonModelObject(body.modelUrl);
      } catch (error) {
        if (error instanceof Error && error.message === "INVALID_NEON_MODEL_FILE") {
          return NextResponse.json({ success: false, message: "The uploaded file is not a valid GLB model." }, { status: 400 });
        }
        throw error;
      }
    }
    const model = await prisma.customPrintModel.update({
      where: { id: current.id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
        ...(typeof body.modelType === "string" ? { modelType: body.modelType.trim() } : {}),
        ...(typeof body.modelUrl === "string" ? { modelUrl: body.modelUrl } : {}),
        ...(printAreas ? { printAreas } : {}),
        ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      },
    });
    return NextResponse.json({ success: true, model: await modelForResponse(model) });
  } catch (error) {
    return adminError(error);
  }
}
