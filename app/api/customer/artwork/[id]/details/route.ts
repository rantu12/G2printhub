import { NextResponse } from "next/server";
import { decryptArtworkSecret } from "@/lib/artwork-secrets";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const artwork = await prisma.customerArtwork.findFirst({
      where: {
        id,
        userId: user.id,
        orderItemId: null,
      },
      select: {
        id: true,
        fileName: true,
        pdfPasswordEncrypted: true,
      },
    });

    if (!artwork) {
      return NextResponse.json(
        { success: false, message: "Saved customization not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      artwork: {
        id: artwork.id,
        fileName: artwork.fileName,
        pdfPassword:
          (await decryptArtworkSecret(artwork.pdfPasswordEncrypted)) ?? "",
      },
    });
  } catch (error) {
    console.error("Customer artwork details error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load saved customization." },
      { status: 500 }
    );
  }
}
