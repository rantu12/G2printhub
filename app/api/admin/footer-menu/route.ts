import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type FooterMenuInput = {
  id?: string;
  label: string;
  href: string;
  isActive: boolean;
};

function isSafeHref(href: string) {
  return (
    (href.startsWith("/") && !href.startsWith("//") && !href.includes("\\")) ||
    /^https:\/\/[^\s]+$/i.test(href)
  );
}

function authError(error: unknown) {
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

  return null;
}

export async function GET() {
  try {
    await requireAdmin();
    const items = await prisma.footerMenuItem.findMany({
      select: {
        id: true,
        label: true,
        href: true,
        isActive: true,
      },
      orderBy: { position: "asc" },
    });

    return NextResponse.json({ success: true, items });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;

    console.error("Admin footer menu GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load footer menu settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdmin();
    const body: unknown = await request.json();

    if (
      body === null ||
      typeof body !== "object" ||
      !("items" in body) ||
      !Array.isArray(body.items) ||
      body.items.length > 20
    ) {
      return NextResponse.json(
        { success: false, message: "Provide up to 20 footer menu links." },
        { status: 400 }
      );
    }

    const items: FooterMenuInput[] = [];
    const ids = new Set<string>();

    for (const item of body.items) {
      if (item === null || typeof item !== "object") {
        return NextResponse.json(
          { success: false, message: "Each footer link must be an object." },
          { status: 400 }
        );
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : undefined;
      const label =
        typeof record.label === "string" ? record.label.trim() : "";
      const href = typeof record.href === "string" ? record.href.trim() : "";

      if (
        (id !== undefined && (!id || ids.has(id))) ||
        !label ||
        label.length > 40 ||
        !isSafeHref(href) ||
        typeof record.isActive !== "boolean"
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Links need a unique ID when editing, a label of up to 40 characters, a safe URL, and an active setting.",
          },
          { status: 400 }
        );
      }

      if (id) ids.add(id);
      items.push({ id, label, href, isActive: record.isActive });
    }

    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.footerMenuItem.findMany({
        select: { id: true },
      });
      const existingIds = new Set(existing.map((item) => item.id));
      const retainedIds: string[] = [];

      for (const [position, item] of items.entries()) {
        if (item.id && !existingIds.has(item.id)) {
          throw new Error("FOOTER_MENU_ITEM_NOT_FOUND");
        }

        if (item.id) {
          await transaction.footerMenuItem.update({
            where: { id: item.id },
            data: {
              label: item.label,
              href: item.href,
              isActive: item.isActive,
              position,
            },
          });
          retainedIds.push(item.id);
        } else {
          const createdItem = await transaction.footerMenuItem.create({
            data: {
              label: item.label,
              href: item.href,
              isActive: item.isActive,
              position,
            },
            select: { id: true },
          });
          retainedIds.push(createdItem.id);
        }
      }

      await transaction.footerMenuItem.deleteMany({
        where: retainedIds.length ? { id: { notIn: retainedIds } } : {},
      });
    });

    const savedItems = await prisma.footerMenuItem.findMany({
      select: {
        id: true,
        label: true,
        href: true,
        isActive: true,
      },
      orderBy: { position: "asc" },
    });

    return NextResponse.json({
      success: true,
      message: "Footer menu saved.",
      items: savedItems,
    });
  } catch (error) {
    const auth = authError(error);
    if (auth) return auth;

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "FOOTER_MENU_ITEM_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A footer link changed. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    console.error("Admin footer menu PUT error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to save footer menu." },
      { status: 500 }
    );
  }
}
