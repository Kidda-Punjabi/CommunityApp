import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { KIDS_PIN_UNLOCKED_COOKIE } from "@/lib/kids/constants";
import { verifyKidsPin } from "@/lib/kids/pin";
import { kidsPinUnlockedCookieOptions } from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";

/** Unlock the profile switcher for this browser session. Does not change the active profile. */
export async function POST(request: Request) {
  const { pin } = (await request.json()) as { pin?: string };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("kids_pin_hash")
    .eq("id", user.id)
    .single();

  const ok = await verifyKidsPin(pin ?? "", profile?.kids_pin_hash ?? null);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect PIN. Try again." }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(KIDS_PIN_UNLOCKED_COOKIE, "1", kidsPinUnlockedCookieOptions());

  return NextResponse.json({ ok: true });
}
