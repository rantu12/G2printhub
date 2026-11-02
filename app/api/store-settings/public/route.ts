import { NextResponse } from "next/server";
import { getStoreSettings } from "@/lib/store-settings";

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json(
      {
        success: true,
        settings: {
          siteName: settings.siteName,
          siteLogo: settings.siteLogo,
          siteFavicon: settings.siteFavicon,
          storeAddress: settings.storeAddress,
          supportEmail: settings.supportEmail,
          supportPhone: settings.supportPhone,
          whatsappNumber: settings.whatsappNumber,
          currency: settings.currency,
          registrationEnabled: settings.registrationEnabled,
          passwordLoginEnabled: settings.passwordLoginEnabled,
          googleSignInEnabled: settings.googleSignInEnabled,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Public store settings GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load store settings." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
