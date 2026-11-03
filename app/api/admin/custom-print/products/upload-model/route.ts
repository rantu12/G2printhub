
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createNeonModelUpload, maxNeonModelSize } from "@/lib/neon-object-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !("fileName" in body) ||
      typeof body.fileName !== "string" ||
      !body.fileName.toLowerCase().endsWith(".glb") ||
      !("fileSize" in body) ||
      typeof body.fileSize !== "number" ||
      !Number.isInteger(body.fileSize) ||
      body.fileSize < 12 ||
      body.fileSize > maxNeonModelSize
    ) {
      return NextResponse.json(
        { success: false, message: "Choose a GLB file between 12 bytes and 20 MB." },
        { status: 400 }
      );
    }

    const upload = await createNeonModelUpload(body.fileSize);
    return NextResponse.json({
      success: true,
      modelUrl: upload.key,
      uploadUrl: upload.uploadUrl,
      previewUrl: upload.previewUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, message: "Please log in first." },
        { status: 401 }
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: 403 }
      );
    }

    if (message === "NEON_OBJECT_STORAGE_ENV_MISSING") {
      return NextResponse.json(
        { success: false, message: "Neon Object Storage is not configured for this environment." },
        { status: 503 }
      );
    }

    console.error(
      "3D model upload URL could not be created:",
      error instanceof Error ? error.message : "Unknown storage error"
    );

    return NextResponse.json(
      { success: false, message: "Unable to prepare the 3D model upload." },
      { status: 500 }
    );
  }
}
