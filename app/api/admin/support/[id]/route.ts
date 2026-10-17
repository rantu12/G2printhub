import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  isRecord,
  isSupportTicketStatus,
  supportAuthError,
} from "@/lib/support";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return NextResponse.json(
        { success: false, message: "Provide a valid ticket update." },
        { status: 400 }
      );
    }

    const statusProvided = Object.hasOwn(body, "status");
    const replyProvided = Object.hasOwn(body, "message");
    const status = isSupportTicketStatus(body.status) ? body.status : undefined;
    if (!statusProvided && !replyProvided) {
      return NextResponse.json(
        { success: false, message: "Provide a ticket status or reply." },
        { status: 400 }
      );
    }

    if (statusProvided && !status) {
      return NextResponse.json(
        { success: false, message: "Choose a valid support status." },
        { status: 400 }
      );
    }

    const message = replyProvided
      ? typeof body.message === "string"
        ? body.message.trim()
        : ""
      : "";
    if (replyProvided && (message.length < 1 || message.length > 5000)) {
      return NextResponse.json(
        { success: false, message: "Reply must be between 1 and 5,000 characters." },
        { status: 400 }
      );
    }

    const ticketExists = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!ticketExists) {
      return NextResponse.json(
        { success: false, message: "Support ticket not found." },
        { status: 404 }
      );
    }
    if (
      replyProvided &&
      ticketExists.status === "CLOSED" &&
      status !== "OPEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Reopen this ticket before sending another reply.",
        },
        { status: 409 }
      );
    }

    const ticket = await prisma.$transaction(async (transaction) => {
      if (status) {
        await transaction.supportTicket.update({
          where: { id },
          data: { status },
        });
      }
      if (replyProvided) {
        await transaction.supportTicketReply.create({
          data: {
            ticketId: id,
            userId: admin.id,
            authorName: admin.name,
            authorRole: "ADMIN",
            message,
          },
        });
      }
      return transaction.supportTicket.findUniqueOrThrow({
        where: { id },
        include: { replies: { orderBy: { createdAt: "asc" } } },
      });
    });

    return NextResponse.json({ success: true, ticket });
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

    console.error("Admin support ticket PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to update the support ticket." },
      { status: 500 }
    );
  }
}
