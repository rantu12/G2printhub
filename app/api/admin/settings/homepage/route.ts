import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/store-settings";

function authError(error: unknown) {
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
  return null;
}

function serializeSettings(settings: {
  homepageEyebrow: string;
  homepageTitle: string;
  homepageDescription: string;
  homepageSaleEnabled: boolean;
  homepageOffer: string;
  homepageImage: string;
}) {
  return {
    homepageEyebrow: settings.homepageEyebrow,
    homepageTitle: settings.homepageTitle,
    homepageDescription: settings.homepageDescription,
    homepageSaleEnabled: settings.homepageSaleEnabled,
    homepageOffer: settings.homepageOffer,
    homepageImage: settings.homepageImage,
  };
}

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getStoreSettings();
    return NextResponse.json({
      success: true,
      settings: serializeSettings(settings),
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    console.error("Homepage settings GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load homepage settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { success: false, message: "Provide valid homepage settings." },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    if (typeof payload.homepageSaleEnabled !== "boolean") {
      return NextResponse.json(
        { success: false, message: "Choose whether the homepage sale is on or off." },
        { status: 400 }
      );
    }

    const textFields = [
      ["homepageEyebrow", "Small heading", 60],
      ["homepageTitle", "Main heading", 120],
      ["homepageDescription", "Description", 400],
      ["homepageOffer", "Offer message", 120],
    ] as const;

    for (const [key, label, maxLength] of textFields) {
      const value = payload[key];
      if (typeof value !== "string") {
        return NextResponse.json(
          { success: false, message: `${label} is required.` },
          { status: 400 }
        );
      }
      if (value.length > maxLength) {
        return NextResponse.json(
          {
            success: false,
            message: `${label} must be ${maxLength} characters or fewer.`,
          },
          { status: 400 }
        );
      }
    }

    if (
      typeof payload.homepageImage !== "string" ||
      (payload.homepageImage !== "" &&
        !/^\/uploads\/homepage\/[0-9a-f-]+\.(jpg|png|webp)$/.test(
          payload.homepageImage
        ))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Upload a valid homepage image or remove the current image.",
        },
        { status: 400 }
      );
    }

    const homepageTitle = (payload.homepageTitle as string).trim();
    if (!homepageTitle) {
      return NextResponse.json(
        { success: false, message: "Main heading cannot be empty." },
        { status: 400 }
      );
    }

    const homepageImage = payload.homepageImage as string;
    await getStoreSettings();
    const settings = await prisma.storeSettings.update({
      where: { id: "default" },
      data: {
        homepageEyebrow: (payload.homepageEyebrow as string).trim(),
        homepageTitle,
        homepageDescription: (payload.homepageDescription as string).trim(),
        homepageSaleEnabled: payload.homepageSaleEnabled,
        homepageOffer: (payload.homepageOffer as string).trim(),
        homepageImage,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Homepage banner settings saved.",
      settings: serializeSettings(settings),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }
    const auth = authError(error);
    if (auth) return auth;
    console.error("Homepage settings PUT error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save homepage settings." },
      { status: 500 }
    );
  }
}
