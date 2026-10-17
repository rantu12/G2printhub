import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { CouponInputError, parseCouponInput } from "@/lib/coupon-input";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
  try {
    await requireAdmin();
    const coupons = await prisma.coupon.findMany({
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;
    console.error("Coupons GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load coupons." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const input = parseCouponInput(await request.json());
    const coupon = await prisma.coupon.create({ data: input });
    return NextResponse.json(
      { success: true, message: "Coupon created successfully.", coupon },
      { status: 201 }
    );
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
    console.error("Coupons POST error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to create coupon." },
      { status: 500 }
    );
  }
}
