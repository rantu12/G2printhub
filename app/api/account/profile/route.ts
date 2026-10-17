import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/auth-security";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in to update your profile." },
      { status: 401 }
    );
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "You cannot update this profile." },
      { status: 403 }
    );
  }

  return null;
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { success: false, message: "A valid profile is required." },
        { status: 400 }
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (normalizeEmail(email) !== normalizeEmail(user.email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Email addresses cannot be changed from profile settings.",
        },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { success: false, message: "Name must be between 2 and 100 characters." },
        { status: 400 }
      );
    }

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (
      phone.length > 30 ||
      (phone !== "" &&
        (!/^\+?[0-9\s().-]{7,30}$/.test(phone) ||
          phone.replace(/\D/g, "").length < 7 ||
          phone.replace(/\D/g, "").length > 15))
    ) {
      return NextResponse.json(
        { success: false, message: "Please enter a valid phone number." },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { name, email, phone: phone || null },
        select: { id: true, name: true, email: true, phone: true },
      });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (isRecord(error) && error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          message: "An account with this email address already exists.",
        },
        { status: 409 }
      );
    }

    const auth = authError(error);
    if (auth) return auth;

    console.error("Account profile PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update your profile." },
      { status: 500 }
    );
  }
}
