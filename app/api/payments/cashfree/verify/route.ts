import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchCashfreeOrder } from "@/lib/cashfree";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Please log in to verify your payment." },
        { status: 401 }
      );
    }

    const orderNumber = new URL(request.url).searchParams.get("order_id")?.trim();
    if (!orderNumber || orderNumber.length > 64) {
      return NextResponse.json(
        { success: false, message: "A valid order number is required." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        orderNumber,
        userId: user.id,
        paymentMethod: "CASHFREE",
      },
      select: {
        id: true,
        orderNumber: true,
        paymentStatus: true,
        status: true,
        total: true,
      },
    });
    if (!order) {
      return NextResponse.json(
        { success: false, message: "The payment order could not be found." },
        { status: 404 }
      );
    }

    if (order.status !== "CANCELLED" && order.paymentStatus !== "PAID") {
      const gatewayOrder = await fetchCashfreeOrder(order.orderNumber);
      if (
        gatewayOrder.order_id !== order.orderNumber ||
        gatewayOrder.order_currency !== "INR" ||
        Math.round(gatewayOrder.order_amount * 100) !==
          Math.round(Number(order.total) * 100)
      ) {
        console.error(
          `Cashfree order verification mismatch for ${order.orderNumber}.`
        );
        return NextResponse.json(
          { success: false, message: "Payment details could not be verified." },
          { status: 502 }
        );
      }

      if (gatewayOrder.order_status === "PAID") {
        await prisma.order.updateMany({
          where: {
            id: order.id,
            userId: user.id,
            paymentMethod: "CASHFREE",
            paymentStatus: "UNPAID",
            status: { not: "CANCELLED" },
          },
          data: { paymentStatus: "PAID" },
        });
      }
    }

    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: {
        orderNumber: true,
        paymentStatus: true,
        status: true,
        total: true,
      },
    });
    return NextResponse.json({
      success: true,
      order: {
        orderNumber: updatedOrder.orderNumber,
        paymentStatus: updatedOrder.paymentStatus,
        status: updatedOrder.status,
        total: updatedOrder.total.toString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CASHFREE_NOT_CONFIGURED") {
      return NextResponse.json(
        { success: false, message: "Cashfree Payments is not configured." },
        { status: 503 }
      );
    }
    if (
      error instanceof Error &&
      [
        "CASHFREE_ENVIRONMENT_INVALID",
        "CASHFREE_CREDENTIALS_ENVIRONMENT_MISMATCH",
        "APP_URL_INVALID",
      ].includes(error.message)
    ) {
      return NextResponse.json(
        { success: false, message: "Cashfree Payments is misconfigured." },
        { status: 503 }
      );
    }
    console.error("Cashfree payment verification error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to verify this Cashfree payment." },
      { status: 502 }
    );
  }
}
