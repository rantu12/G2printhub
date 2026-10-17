import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const redirectPath =
      new URL(request.url).searchParams.get("redirectTo") === "admin"
        ? "/admin/login"
        : "/";

    await destroySession();

    return NextResponse.redirect(new URL(redirectPath, request.url), 303);
  } catch (error) {
    console.error("Logout error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to log out. Please try again.",
      },
      { status: 500 }
    );
  }
}
