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
      return NextResponse.json({ success: false, message: "Please log in first." }, { status: 401 });
    }
    if (message === "FORBIDDEN") {
      return NextResponse.json({ success: false, message: "Admin access required." }, { status: 403 });
    }
    console.error("Custom Print product image upload failed:", error);
    return NextResponse.json(
      { success: false, message: "Unable to upload the product image." },
      { status: 500 }
    );
  }
}
