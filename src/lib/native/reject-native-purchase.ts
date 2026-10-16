import { NextResponse } from "next/server";
import { isNativeAppRequest } from "@/lib/native/platform";

export function rejectNativePurchase(request: Request): NextResponse | null {
  if (!isNativeAppRequest(request.headers)) return null;
  return NextResponse.json(
    { error: "Purchases aren't available in the Kidda app." },
    { status: 403 }
  );
}
