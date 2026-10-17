import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { saveAdminImage } from "@/lib/admin-image-upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const formData = await request.formData();
    const result = await saveAdminImage(formData.get("image"), "homepage");

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      image: result.image,
    });
  } catch (error) {
    console.error("Homepage image upload error:", error);

    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, message: "Admin access required." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to upload homepage image." },
      { status: 500 }
    );
  }
}
