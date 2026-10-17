import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { consumeAuthRateLimit, getRequestIdentity } from "@/lib/auth-rate-limit";
import { prisma } from "@/lib/prisma";
import {
  hasPrismaCode,
  isRecord,
  supportAuthError,
} from "@/lib/support";

function ticketNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PH-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function GET() {
  try {
    const user = await requireUser();
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: user.id },
      include: {
        replies: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            authorName: true,
            authorRole: true,
            message: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, tickets });
  } catch (error) {
    const auth = supportAuthError(error, "Please log in to view your support tickets.");
    if (auth) {
      return NextResponse.json(
        { success: false, message: auth.message },
        { status: auth.status }
      );
    }

    console.error("Customer support tickets GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load your support tickets." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { success: false, message: "Provide valid support request details." },
        { status: 400 }
      );
    }

    if (
      (Object.hasOwn(body, "website") && typeof body.website !== "string") ||
      (typeof body.website === "string" && body.website.trim())
    ) {
      return NextResponse.json(
        { success: false, message: "Unable to submit this support request." },
        { status: 400 }
      );
    }
    if (Object.hasOwn(body, "orderId") && typeof body.orderId !== "string") {
      return NextResponse.json(
        { success: false, message: "Order ID must be text." },
        { status: 400 }
      );
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const orderId =
      typeof body.orderId === "string" ? body.orderId.trim() : "";
    const subject =
      typeof body.subject === "string" ? body.subject.trim() : "";
    const message =
      typeof body.message === "string" ? body.message.trim() : "";

    if (name.length < 2 || name.length > 100) {
      return NextResponse.json(
        { success: false, message: "Name must be between 2 and 100 characters." },
        { status: 400 }
      );
    }
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return NextResponse.json(
        { success: false, message: "Enter a valid email address." },
        { status: 400 }
      );
    }
    if (orderId.length > 100) {
      return NextResponse.json(
        { success: false, message: "Order ID must be 100 characters or fewer." },
        { status: 400 }
      );
    }
    if (subject.length < 3 || subject.length > 150) {
      return NextResponse.json(
        { success: false, message: "Subject must be between 3 and 150 characters." },
        { status: 400 }
      );
    }
    if (message.length < 10 || message.length > 5000) {
      return NextResponse.json(
        { success: false, message: "Message must be between 10 and 5,000 characters." },
        { status: 400 }
      );
    }
    if (
      [name, orderId, subject, message].some((value) =>
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Remove unsupported control characters from your request." },
        { status: 400 }
      );
    }

    const identity = getRequestIdentity(request) || "unknown";
    const allowedByIp = await consumeAuthRateLimit(
      "support-ticket-ip",
      identity,
      5,
      15 * 60 * 1000
    );
    const allowedByEmail = await consumeAuthRateLimit(
      "support-ticket-email",
      email,
      3,
      60 * 60 * 1000
    );
    if (!allowedByIp || !allowedByEmail) {
      return NextResponse.json(
        {
          success: false,
          message: "Too many support requests. Please try again later.",
        },
        { status: 429 }
      );
    }

    const user = await getCurrentUser();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const ticket = await prisma.supportTicket.create({
          data: {
            ticketNumber: ticketNumber(),
            userId: user?.id ?? null,
            name,
            email,
            orderId: orderId || null,
            subject,
            message,
          },
          select: { ticketNumber: true },
        });
        return NextResponse.json(
          {
            success: true,
            message: "Your support request has been received.",
            ticketNumber: ticket.ticketNumber,
          },
          { status: 201 }
        );
      } catch (error) {
        if (!hasPrismaCode(error, "P2002") || attempt === 2) throw error;
      }
    }

    throw new Error("SUPPORT_TICKET_CREATE_FAILED");
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    console.error("Support ticket POST error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to submit your support request." },
      { status: 500 }
    );
  }
}
