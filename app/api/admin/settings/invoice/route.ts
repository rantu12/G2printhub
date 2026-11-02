import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ensureStoreSettings } from "@/lib/store-settings";
import { prisma } from "@/lib/prisma";

const invoiceFieldLimits = {
  invoiceTitle: 50,
  invoiceTagline: 160,
  invoiceSellerName: 160,
  invoiceGstin: 30,
  invoicePan: 20,
  invoiceAddress: 600,
  invoiceContact: 160,
  invoiceReturnPolicy: 2000,
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return json({ success: false, message: "Authentication required." }, 401);
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return json({ success: false, message: "Admin access required." }, 403);
  }
  return null;
}

function invoiceSettings(settings: Awaited<ReturnType<typeof ensureStoreSettings>>) {
  return Object.fromEntries(
    Object.keys(invoiceFieldLimits).map((key) => [
      key,
      settings[key as keyof typeof invoiceFieldLimits],
    ])
  );
}

export async function GET() {
  try {
    await requireAdmin();
    const settings = await ensureStoreSettings(prisma);
    return json({ success: true, settings: invoiceSettings(settings) });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    console.error("Admin invoice settings GET error:", error);
    return json(
      { success: false, message: "Unable to load invoice settings." },
      500
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, message: "Invalid invoice settings." }, 400);
    }

    const values = body as Record<string, unknown>;
    const keys = Object.keys(invoiceFieldLimits) as Array<
      keyof typeof invoiceFieldLimits
    >;
    if (
      Object.keys(values).length !== keys.length ||
      keys.some(
        (key) =>
          typeof values[key] !== "string" ||
          (values[key] as string).trim().length > invoiceFieldLimits[key]
      ) ||
      Object.keys(values).some(
        (key) => !keys.includes(key as keyof typeof invoiceFieldLimits)
      )
    ) {
      return json(
        {
          success: false,
          message: "Enter valid invoice settings within the listed limits.",
        },
        400
      );
    }

    const settings = await ensureStoreSettings(prisma);
    const updated = await prisma.storeSettings.update({
      where: { id: settings.id },
      data: Object.fromEntries(
        keys.map((key) => [key, (values[key] as string).trim()])
      ),
    });
    return json({
      success: true,
      settings: invoiceSettings(updated),
      message: "Invoice settings saved.",
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    console.error("Admin invoice settings PUT error:", error);
    return json(
      { success: false, message: "Unable to save invoice settings." },
      500
    );
  }
}
