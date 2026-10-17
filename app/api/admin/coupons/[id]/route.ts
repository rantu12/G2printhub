import { NextResponse } from "next/server";
import { CouponInputError, parseCouponInput } from "@/lib/coupon-input";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

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

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    const input = parseCouponInput(await request.json());
    const coupon = await prisma.coupon.update({
      where: { id },
      data: input,
    });
    return NextResponse.json({
      success: true,
      message: "Coupon updated successfully.",
      coupon,
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid JSON request.",
        },
        { status: 400 }
      );
    }
    if (error instanceof CouponInputError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "That coupon code already exists." },
        { status: 409 }
      );
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, message: "Coupon not found." },
        { status: 404 }
      );
    }
    console.error("Coupons PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update coupon." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    await prisma.coupon.delete({ where: { id } });
    return NextResponse.json({
      success: true,
      message: "Coupon deleted successfully.",
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, message: "Coupon not found." },
        { status: 404 }
      );
    }
    console.error("Coupons DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to delete coupon." },
      { status: 500 }
    );
  }
}
