import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { consumeAuthRateLimit } from "@/lib/auth-rate-limit";
import { prisma } from "@/lib/prisma";
import { isRecord, supportAuthError } from "@/lib/support";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body: unknown = await request.json();
    const message =
      isRecord(body) && typeof body.message === "string"
        ? body.message.trim()
        : "";

    if (message.length < 1 || message.length > 5000) {
      return NextResponse.json(
        { success: false, message: "Reply must be between 1 and 5,000 characters." },
        { status: 400 }
      );
    }
    if (
      !(await consumeAuthRateLimit(
        "support-reply-user",
        user.id,
        10,
        10 * 60 * 1000
      ))
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many replies. Please wait before sending another.",
        },
        { status: 429 }
      );
    }

    const result = await prisma.$transaction(async (transaction) => {
      const ticket = await transaction.supportTicket.findFirst({
        where: { id, userId: user.id },
        select: { id: true, status: true },
      });
      if (!ticket) return { kind: "not-found" as const };
      if (ticket.status === "CLOSED") return { kind: "closed" as const };

      const reply = await transaction.supportTicketReply.create({
        data: {
          ticketId: ticket.id,
          userId: user.id,
          authorName: user.name,
          authorRole: "CUSTOMER",
          message,
        },
        select: {
          id: true,
          authorName: true,
          authorRole: true,
          message: true,
          createdAt: true,
        },
      });
      const updatedTicket = await transaction.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "OPEN" },
        select: { status: true },
      });

      return { kind: "success" as const, reply, status: updatedTicket.status };
    });

    if (result.kind === "not-found") {
      return NextResponse.json(
        { success: false, message: "Support ticket not found." },
        { status: 404 }
      );
    }
    if (result.kind === "closed") {
      return NextResponse.json(
        {
          success: false,
          message: "This ticket is closed. Submit a new support request for further help.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      reply: result.reply,
      status: result.status,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const auth = supportAuthError(error, "Please log in to reply to a support ticket.");
    if (auth) {
      return NextResponse.json(
        { success: false, message: auth.message },
        { status: auth.status }
      );
    }

    console.error("Customer support reply POST error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to send your reply." },
      { status: 500 }
    );
  }
}
