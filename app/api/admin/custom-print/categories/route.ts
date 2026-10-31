
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handleError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "UNAUTHORIZED") {
    return NextResponse.json(
      { success: false, message: "Please log in first." },
      { status: 401 }
    );
  }

  if (message === "FORBIDDEN") {
    return NextResponse.json(
      { success: false, message: "Admin access required." },
      { status: 403 }
    );
  }

  console.error("Custom Print categories API error:", error);

  return NextResponse.json(
    { success: false, message: "Unable to process categories." },
    { status: 500 }
  );
}

export async function GET() {
  try {
    await requireAdmin();

    const categories = await prisma.customPrintCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const slug =
      typeof body.slug === "string"
        ? body.slug.trim().toLowerCase()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null;

    const image =
      typeof body.image === "string"
        ? body.image.trim() || null
        : null;

    const sortOrder = Number(body.sortOrder ?? 0);

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, message: "Category name and slug are required." },
        { status: 400 }
      );
    }

    if (
      name.length > 100 ||
      slug.length > 120 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid category name or slug." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(sortOrder)) {
      return NextResponse.json(
        { success: false, message: "Sort order must be a whole number." },
        { status: 400 }
      );
    }

    const existing = await prisma.customPrintCategory.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: "Category name or slug already exists." },
        { status: 409 }
      );
    }

    const category = await prisma.customPrintCategory.create({
      data: {
        name,
        slug,
        description,
        image,
        sortOrder,
        active: typeof body.active === "boolean" ? body.active : true,
      },
    });

    return NextResponse.json(
      { success: true, category },
      { status: 201 }
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slug =
      typeof body.slug === "string"
        ? body.slug.trim().toLowerCase()
        : "";
    const description =
      typeof body.description === "string"
        ? body.description.trim() || null
        : null;
    const image =
      body.image === null || typeof body.image === "string"
        ? body.image?.trim() || null
        : undefined;
    const sortOrder = Number(body.sortOrder ?? 0);

    if (!id || !name || !slug) {
      return NextResponse.json(
        { success: false, message: "Category ID, name and slug are required." },
        { status: 400 }
      );
    }

    if (
      name.length > 100 ||
      slug.length > 120 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
      !Number.isInteger(sortOrder) ||
      (body.image !== undefined &&
        body.image !== null &&
        (typeof body.image !== "string" || body.image.length > 500)) ||
      (body.active !== undefined && typeof body.active !== "boolean")
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid category details." },
        { status: 400 }
      );
    }

    const category = await prisma.customPrintCategory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Category not found." },
        { status: 404 }
      );
    }

    const duplicate = await prisma.customPrintCategory.findFirst({
      where: {
        id: { not: id },
        OR: [{ name }, { slug }],
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { success: false, message: "Category name or slug already exists." },
        { status: 409 }
      );
    }

    const updatedCategory = await prisma.customPrintCategory.update({
      where: { id },
      data: {
        name,
        slug,
        description,
        ...(image !== undefined ? { image } : {}),
        sortOrder,
        ...(typeof body.active === "boolean" ? { active: body.active } : {}),
      },
    });

    return NextResponse.json({ success: true, category: updatedCategory });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin();

    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Category ID is required." },
        { status: 400 }
      );
    }

    const category = await prisma.customPrintCategory.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, message: "Category not found." },
        { status: 404 }
      );
    }

    const result = await prisma.customPrintCategory.deleteMany({
      where: {
        id,
        products: { none: {} },
      },
    });

    if (result.count === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Categories with products cannot be deleted.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
