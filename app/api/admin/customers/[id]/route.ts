import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await request.json();

    if (typeof body.isBlocked !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          message: "A valid blocked status is required.",
        },
        { status: 400 }
      );
    }

    if (id === admin.id) {
      return NextResponse.json(
        {
          success: false,
          message: "You cannot block your own account.",
        },
        { status: 400 }
      );
    }

    const customer = await prisma.user.findFirst({
      where: {
        id,
        role: "CUSTOMER",
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        {
          success: false,
          message: "Customer not found.",
        },
        { status: 404 }
      );
    }

    const updatedCustomer = await prisma.user.update({
      where: {
        id: customer.id,
      },
      data: {
        isBlocked: body.isBlocked,
      },
      select: {
        id: true,
        isBlocked: true,
      },
    });

    if (updatedCustomer.isBlocked) {
      await prisma.session.deleteMany({
        where: {
          userId: updatedCustomer.id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
    });
  } catch (error) {
    console.error("Admin customer PATCH error:", error);

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
      { success: false, message: "Unable to update customer status." },
      { status: 500 }
    );
  }
}
