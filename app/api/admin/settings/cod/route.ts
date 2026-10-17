import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureStoreSettings, getStoreSettings } from "@/lib/store-settings";

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Authentication required." },
      { status: 401 },
    );
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "Admin access required." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getStoreSettings();

    return NextResponse.json({
      success: true,
      codEnabled: settings.codEnabled,
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;

    console.error("Admin COD settings GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load Cash on Delivery setting." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Provide a valid settings payload." },
        { status: 400 },
      );
    }

    const payload = body as Record<string, unknown>;
    if (typeof payload.codEnabled !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          message: "Choose whether Cash on Delivery is enabled (true/false).",
        },
        { status: 400 },
      );
    }

    const settings = await ensureStoreSettings(prisma, {
      codEnabled: payload.codEnabled,
    });

    return NextResponse.json({
      success: true,
      message: settings.codEnabled
        ? "Cash on Delivery is now enabled for customer checkout."
        : "Cash on Delivery is now disabled. Customers must choose online payment.",
      codEnabled: settings.codEnabled,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 },
      );
    }

    const auth = authError(error);
    if (auth) return auth;

    console.error("Admin COD settings PUT error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save Cash on Delivery setting." },
      { status: 500 },
    );
  }
}
