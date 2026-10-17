import { assetLinks } from "@/lib/native/asset-links";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(assetLinks(process.env.ANDROID_CERT_SHA256), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
