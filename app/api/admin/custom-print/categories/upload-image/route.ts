import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { saveAdminImage } from "@/lib/admin-image-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const result = await saveAdminImage(formData.get("image"), "custom-print");

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, image: result.image });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    if (message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: 403 }
      );
    }

    console.error("Custom Print category image upload error:", error);

    return NextResponse.json(
      { success: false, message: "Unable to upload category image." },
      { status: 500 }
    );
  }
}
