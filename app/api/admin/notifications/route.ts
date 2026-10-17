import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireAdmin();

    const recentOrdersWithoutNotifications = await prisma.order.findMany({
      where: { notification: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true },
    });

    if (recentOrdersWithoutNotifications.length > 0) {
      await prisma.adminNotification.createMany({
        data: recentOrdersWithoutNotifications.map(({ id }) => ({ orderId: id })),
        skipDuplicates: true,
      });
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.adminNotification.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              total: true,
            },
          },
        },
      }),
      prisma.adminNotification.count({ where: { readAt: null } }),
    ]);

    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (error) {
    console.error("Admin notifications load error:", error);

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

    return NextResponse.json(
      { success: false, message: "Unable to load admin notifications." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();

    const body: unknown = await request.json();
    if (
      body === null ||
      typeof body !== "object" ||
      !("notificationId" in body) ||
      typeof body.notificationId !== "string" ||
      !body.notificationId.trim()
    ) {
      return NextResponse.json(
        { success: false, message: "A valid notification ID is required." },
        { status: 400 },
      );
    }

    const result = await prisma.adminNotification.updateMany({
      where: { id: body.notificationId.trim(), readAt: null },
      data: { readAt: new Date() },
    });

    if (result.count === 0) {
      const notification = await prisma.adminNotification.findUnique({
        where: { id: body.notificationId.trim() },
        select: { id: true },
      });
      if (!notification) {
        return NextResponse.json(
          { success: false, message: "Notification not found." },
          { status: 404 },
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 },
      );
    }
    console.error("Admin notification update error:", error);

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

    return NextResponse.json(
      { success: false, message: "Unable to update the notification." },
      { status: 500 },
    );
  }
}
