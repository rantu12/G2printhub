import { NextResponse } from "next/server";
import { getStoreSettings } from "@/lib/store-settings";

export async function GET() {
  try {
    const settings = await getStoreSettings();

    return NextResponse.json({
      success: true,
      settings: {
        homepageEyebrow: settings.homepageEyebrow,
        homepageTitle: settings.homepageTitle,
        homepageDescription: settings.homepageDescription,
        homepageSaleEnabled: settings.homepageSaleEnabled,
        homepageOffer: settings.homepageOffer,
        homepageImage: settings.homepageImage,
      },
    });
  } catch (error) {
    console.error("Homepage settings public GET error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load homepage settings." },
      { status: 500 }
    );
  }
}
