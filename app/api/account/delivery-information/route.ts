import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const fields = [
  "customerName",
  "customerEmail",
  "customerPhone",
  "shippingAddress",
  "shippingAddress2",
  "city",
  "state",
  "postalCode",
  "country",
] as const;

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in to manage delivery information." },
      { status: 401 }
    );
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "You cannot manage delivery information." },
      { status: 403 }
    );
  }

  return null;
}

export async function GET() {
  try {
    const user = await requireUser();
    const deliveryInformation = await prisma.deliveryInformation.findUnique({
      where: { userId: user.id },
      select: {
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        shippingAddress: true,
        shippingAddress2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    });

    return NextResponse.json({
      success: true,
      deliveryInformation,
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;

    console.error("Delivery information GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load delivery information." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const body: unknown = await request.json();

    if (body === null || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid delivery information." },
        { status: 400 }
      );
    }

    const data = Object.fromEntries(
      fields.map((field) => [
        field,
        typeof (body as Record<string, unknown>)[field] === "string"
          ? ((body as Record<string, string>)[field] ?? "").trim()
          : "",
      ])
    ) as Record<(typeof fields)[number], string>;
    data.customerEmail = data.customerEmail.toLowerCase();

    if (
      !data.customerName ||
      !data.customerEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail) ||
      !data.customerPhone ||
      !/^\+?[0-9\s().-]{7,30}$/.test(data.customerPhone) ||
      !data.shippingAddress ||
      !data.city ||
      !data.postalCode ||
      !data.country
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Complete all required contact and delivery fields before saving.",
        },
        { status: 400 }
      );
    }

    const maxLengths: Record<(typeof fields)[number], number> = {
      customerName: 120,
      customerEmail: 254,
      customerPhone: 30,
      shippingAddress: 500,
      shippingAddress2: 250,
      city: 100,
      state: 100,
      postalCode: 20,
      country: 100,
    };

    if (fields.some((field) => data[field].length > maxLengths[field])) {
      return NextResponse.json(
        { success: false, message: "One or more delivery fields are too long." },
        { status: 400 }
      );
    }

    const deliveryInformation = await prisma.deliveryInformation.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...data,
        shippingAddress2: data.shippingAddress2 || null,
        state: data.state || null,
      },
      update: {
        ...data,
        shippingAddress2: data.shippingAddress2 || null,
        state: data.state || null,
      },
      select: {
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        shippingAddress: true,
        shippingAddress2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Delivery information saved to your account.",
      deliveryInformation,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    const auth = authError(error);
    if (auth) return auth;

    console.error("Delivery information PUT error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save delivery information." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    const result = await prisma.deliveryInformation.deleteMany({
      where: { userId: user.id },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, message: "No saved address was found to delete." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Saved address deleted. Existing orders are unchanged.",
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;

    console.error("Delivery information DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to delete the saved address." },
      { status: 500 }
    );
  }
}
