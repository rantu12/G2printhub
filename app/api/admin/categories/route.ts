import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

function authError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json(
      {
        success: false,
        message: "Authentication required.",
      },
      { status: 401 }
    );
  }

  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json(
      {
        success: false,
        message: "Admin access required.",
      },
      { status: 403 }
    );
  }

  return null;
}

export async function GET() {
  try {
    await requireAdmin();

    const categories = await prisma.category.findMany({
      orderBy: {
        createdAt: "desc",
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error("Categories GET error:", error);

    const auth = authError(error);

    if (auth) {
      return auth;
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load categories.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    const slug =
      typeof body.slug === "string"
        ? body.slug.trim().toLowerCase()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    const image =
      typeof body.image === "string"
        ? body.image.trim()
        : null;

    const active =
      typeof body.active === "boolean"
        ? body.active
        : true;

    if (!name || !slug) {
      return NextResponse.json(
        {
          success: false,
          message: "Category name and slug are required.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findFirst({
      where: {
        OR: [
          {
            name,
          },
          {
            slug,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Category name or slug already exists.",
        },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        image,
        active,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Category created successfully.",
        category,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Category POST error:", error);

    const auth = authError(error);

    if (auth) {
      return auth;
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create category.",
      },
      { status: 500 }
    );
  }
}