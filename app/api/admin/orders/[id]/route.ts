import { randomUUID } from "node:crypto";
import { rename, unlink } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { artworkDirectory, customerArtworkPath } from "@/lib/customer-artwork";
import { isCourierPartnerName } from "@/lib/courier-partners";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const allowedTransitions: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["SHIPPED"],
  SHIPPED: ["DELIVERED"],
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await context.params;
    const body: unknown = await request.json();

    if (body === null || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "A valid order update is required." },
        { status: 400 }
      );
    }

    const update = body as Record<string, unknown>;
    const hasStatus = "status" in update;
    const hasPaymentStatus = "paymentStatus" in update;
    const hasTrackingNumber = "trackingNumber" in update;
    const hasCourierPartnerName = "courierPartnerName" in update;
    const hasShippingDetails = hasTrackingNumber || hasCourierPartnerName;
    const updateCount =
      Number(hasStatus) + Number(hasPaymentStatus) + Number(hasShippingDetails);

    if (updateCount !== 1) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Provide an order status, payment status, or shipping details update.",
        },
        { status: 400 }
      );
    }

    if (hasShippingDetails) {
      const order = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          trackingNumber: true,
          courierPartnerName: true,
        },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, message: "Order not found." },
          { status: 404 }
        );
      }

      let trackingNumber = order.trackingNumber;
      if (hasTrackingNumber) {
        const value = update.trackingNumber;
        if (typeof value !== "string" || value.length > 100) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Tracking number must be text of 100 characters or fewer.",
            },
            { status: 400 }
          );
        }
        trackingNumber = value.trim() || null;
      }

      let courierPartnerName = order.courierPartnerName;
      if (hasCourierPartnerName) {
        const value = update.courierPartnerName;
        if (
          typeof value !== "string" ||
          value.length > 100 ||
          (value.trim() !== "" && !isCourierPartnerName(value.trim()))
        ) {
          return NextResponse.json(
            {
              success: false,
              message:
                "Select a supported courier partner or clear the field.",
            },
            { status: 400 }
          );
        }
        courierPartnerName = value.trim() || null;
      }

      const result = await prisma.order.updateMany({
        where: {
          id: order.id,
          trackingNumber: order.trackingNumber,
          courierPartnerName: order.courierPartnerName,
        },
        data: { trackingNumber, courierPartnerName },
      });

      if (result.count !== 1) {
        return NextResponse.json(
          {
            success: false,
            message: "The shipping details changed. Refresh and try again.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        order: { id: order.id, trackingNumber, courierPartnerName },
      });
    }

    if (hasPaymentStatus) {
      if (
        typeof update.paymentStatus !== "string" ||
        !["PAID", "UNPAID"].includes(update.paymentStatus)
      ) {
        return NextResponse.json(
          { success: false, message: "Payment status must be PAID or UNPAID." },
          { status: 400 }
        );
      }

      const order = await prisma.order.findUnique({
        where: { id },
        select: { id: true, paymentStatus: true },
      });

      if (!order) {
        return NextResponse.json(
          { success: false, message: "Order not found." },
          { status: 404 }
        );
      }

      const result = await prisma.order.updateMany({
        where: {
          id: order.id,
          paymentStatus: order.paymentStatus,
        },
        data: {
          paymentStatus: update.paymentStatus,
        },
      });

      if (result.count !== 1) {
        return NextResponse.json(
          {
            success: false,
            message: "The payment status changed. Refresh and try again.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          paymentStatus: update.paymentStatus,
        },
      });
    }

    if (typeof update.status !== "string") {
      return NextResponse.json(
        { success: false, message: "A valid order status is required." },
        { status: 400 }
      );
    }

    const nextStatus = update.status;
    const order = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found." },
        { status: 404 }
      );
    }

    if (!allowedTransitions[order.status]?.includes(nextStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot change order status from ${order.status} to ${nextStatus}.`,
        },
        { status: 409 }
      );
    }

    const result = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: order.status,
      },
      data: {
        status: nextStatus,
      },
    });

    if (result.count !== 1) {
      return NextResponse.json(
        {
          success: false,
          message: "The order status changed. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        status: nextStatus,
      },
    });
  } catch (error) {
    console.error("Admin order PATCH error:", error);

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

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Unable to update order status." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const stagedFiles: { originalPath: string; stagedPath: string }[] = [];

  try {
    await requireAdmin();

    const { id } = await context.params;
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        items: {
          select: {
            productId: true,
            artwork: {
              select: {
                id: true,
                storageKey: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found." },
        { status: 404 }
      );
    }

    const artworks = order.items.flatMap((item) =>
      item.artwork ? [item.artwork] : []
    );
    const productIds = [
      ...new Set(
        order.items
          .map((item) => item.productId)
          .filter((productId): productId is string => productId !== null)
      ),
    ];

    const matchingUnassignedArtworks =
      order.userId && productIds.length > 0
        ? await prisma.customerArtwork.findMany({
            where: {
              userId: order.userId,
              productId: { in: productIds },
              orderItemId: null,
              createdAt: { lte: order.createdAt },
            },
            select: {
              id: true,
              productId: true,
              createdAt: true,
              storageKey: true,
            },
          })
        : [];

    const relatedOrders =
      order.userId && productIds.length > 0
        ? await prisma.order.findMany({
            where: {
              userId: order.userId,
              items: {
                some: {
                  productId: { in: productIds },
                },
              },
            },
            select: {
              id: true,
              createdAt: true,
              items: {
                select: { productId: true },
              },
            },
            orderBy: { createdAt: "asc" },
          })
        : [];

    const artworkIdsToDelete = new Set(artworks.map((artwork) => artwork.id));

    for (const artwork of matchingUnassignedArtworks) {
      const matchingOrder = relatedOrders.find(
        (candidate) =>
          candidate.createdAt >= artwork.createdAt &&
          candidate.items.some((item) => item.productId === artwork.productId)
      );

      if (matchingOrder?.id === order.id) {
        artworkIdsToDelete.add(artwork.id);
        artworks.push(artwork);
      }
    }

    for (const artwork of artworks) {
      if (!artwork.storageKey) continue;

      const originalPath = customerArtworkPath(artwork.storageKey);
      const stagedPath = path.join(
        artworkDirectory,
        `${randomUUID()}${path.extname(artwork.storageKey)}`
      );
      await rename(originalPath, stagedPath);
      stagedFiles.push({ originalPath, stagedPath });
    }

    await prisma.$transaction(async (tx) => {
      if (artworkIdsToDelete.size > 0) {
        await tx.customerArtwork.deleteMany({
          where: { id: { in: [...artworkIdsToDelete] } },
        });
      }
      await tx.order.delete({ where: { id: order.id } });
    });

    for (const file of stagedFiles) {
      try {
        await unlink(file.stagedPath);
      } catch (error) {
        console.error("Unable to remove deleted order artwork file:", error);
        return NextResponse.json(
          {
            success: false,
            message:
              "The order was deleted, but an uploaded artwork file could not be removed. Contact support.",
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Order and associated customer uploads deleted successfully.",
    });
  } catch (error) {
    for (const file of stagedFiles.reverse()) {
      try {
        await rename(file.stagedPath, file.originalPath);
      } catch (restoreError) {
        console.error("Unable to restore staged order artwork file:", restoreError);
      }
    }

    console.error("Admin order DELETE error:", error);

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
      {
        success: false,
        message: "Unable to delete the order and its uploaded artwork.",
      },
      { status: 500 }
    );
  }
}
