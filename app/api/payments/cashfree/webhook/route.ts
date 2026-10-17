import { NextResponse } from "next/server";
import {
  isCashfreeConfigured,
  verifyCashfreeWebhookSignature,
} from "@/lib/cashfree";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function POST(request: Request) {
  try {
    if (!(await isCashfreeConfigured())) {
      return NextResponse.json(
        { success: false, message: "Cashfree Payments is not configured." },
        { status: 503 }
      );
    }

    const rawBody = await request.text();
    const validSignature = await verifyCashfreeWebhookSignature(
      rawBody,
      request.headers.get("x-webhook-timestamp"),
      request.headers.get("x-webhook-signature")
    );
    if (!validSignature) {
      return NextResponse.json(
        { success: false, message: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid webhook payload." },
        { status: 400 }
      );
    }

    const data = record(record(payload)?.data);
    const gatewayOrder = record(data?.order);
    const payment = record(data?.payment);
    if (payment?.payment_status !== "SUCCESS") {
      return NextResponse.json({ success: true });
    }

    const orderNumber =
      typeof gatewayOrder?.order_id === "string"
        ? gatewayOrder.order_id
        : "";
    const amount = Number(gatewayOrder?.order_amount);
    if (!orderNumber || !Number.isFinite(amount)) {
      return NextResponse.json(
        { success: false, message: "Invalid payment details." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        total: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
      },
    });
    if (!order || order.paymentMethod !== "CASHFREE") {
      return NextResponse.json(
        { success: false, message: "Payment order not found." },
        { status: 404 }
      );
    }
    if (
      Math.round(amount * 100) !== Math.round(Number(order.total) * 100) ||
      gatewayOrder?.order_currency !== "INR"
    ) {
      console.error(`Cashfree webhook amount mismatch for ${orderNumber}.`);
      return NextResponse.json(
        { success: false, message: "Payment amount did not match the order." },
        { status: 400 }
      );
    }

    if (order.status !== "CANCELLED" && order.paymentStatus !== "PAID") {
      await prisma.order.updateMany({
        where: {
          id: order.id,
          paymentMethod: "CASHFREE",
          paymentStatus: "UNPAID",
          status: { not: "CANCELLED" },
        },
        data: { paymentStatus: "PAID" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cashfree webhook error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to process Cashfree webhook." },
      { status: 500 }
    );
  }
}
