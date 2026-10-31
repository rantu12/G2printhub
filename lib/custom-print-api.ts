import { NextResponse } from "next/server";

export function customPrintAuthError(error: unknown) {
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

export function customPrintDatabaseError(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  if (code === "P2002") {
    return NextResponse.json(
      { success: false, message: "A Custom Print record with that name, slug, or SKU already exists." },
      { status: 409 }
    );
  }
  if (code === "P2025") {
    return NextResponse.json(
      { success: false, message: "Custom Print record not found." },
      { status: 404 }
    );
  }
  if (code === "P2003" || code === "P2014") {
    return NextResponse.json(
      { success: false, message: "This record is still referenced and cannot be changed or deleted." },
      { status: 409 }
    );
  }
  return null;
}

export function logCustomPrintApiError(context: string, error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  console.error(`${context}:`, code ?? (error instanceof Error ? error.name : "UnknownError"));
}

export async function readJsonBody(request: Request): Promise<
  | { success: true; value: unknown }
  | { success: false; response: ReturnType<typeof NextResponse.json> }
> {
  try {
    return { success: true, value: await request.json() };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { success: false, message: "Invalid JSON request." },
        { status: 400 }
      ),
    };
  }
}
