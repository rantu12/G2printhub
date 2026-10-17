import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isSupportTicketStatus,
  supportAuthError,
} from "@/lib/support";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const params = new URL(request.url).searchParams;
    const query = (params.get("q") ?? "").trim();
    const status = params.get("status") ?? "";
    const pageValue = params.get("page") ?? "1";
    const page = Number(pageValue);

    if (query.length > 100) {
      return NextResponse.json(
        { success: false, message: "Search must be 100 characters or fewer." },
        { status: 400 }
      );
    }
    if (
      !/^\d+$/.test(pageValue) ||
      !Number.isSafeInteger(page) ||
      page < 1
    ) {
      return NextResponse.json(
        { success: false, message: "Choose a valid ticket page." },
        { status: 400 }
      );
    }
    if (status && !isSupportTicketStatus(status)) {
      return NextResponse.json(
        { success: false, message: "Choose a valid support status." },
        { status: 400 }
      );
    }

    const where = {
      ...(status ? { status } : {}),
      ...(query
        ? {
            OR: [
              { ticketNumber: { contains: query, mode: "insensitive" as const } },
              { name: { contains: query, mode: "insensitive" as const } },
              { email: { contains: query, mode: "insensitive" as const } },
              { subject: { contains: query, mode: "insensitive" as const } },
              { orderId: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const pageSize = 50;
    const total = await prisma.supportTicket.count({ where });
    if (page > Math.max(1, Math.ceil(total / pageSize))) {
      return NextResponse.json({ success: true, tickets: [], page, pageSize, total });
    }
    const tickets = await prisma.supportTicket.findMany({
      where,
      include: {
        replies: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return NextResponse.json({ success: true, tickets, page, pageSize, total });
  } catch (error) {
    const auth = supportAuthError(error, "Admin access required.");
    if (auth) {
      return NextResponse.json(
        { success: false, message: auth.message },
        { status: auth.status }
      );
    }

    console.error("Admin support tickets GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load support tickets." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();

    if (
      body === null ||
      typeof body !== "object" ||
      !("confirmation" in body) ||
      body.confirmation !== "DELETE ALL"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: 'Type "DELETE ALL" to confirm permanent ticket deletion.',
        },
        { status: 400 }
      );
    }

    const result = await prisma.supportTicket.deleteMany();
    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const auth = supportAuthError(error, "Admin access required.");
    if (auth) {
      return NextResponse.json(
        { success: false, message: auth.message },
        { status: auth.status }
      );
    }

    console.error("Admin support tickets DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to clear support tickets." },
      { status: 500 }
    );
  }
}
