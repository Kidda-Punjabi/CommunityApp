import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { KIDS_PIN_UNLOCKED_COOKIE } from "@/lib/kids/constants";
import { hashKidsPin, isValidPin, verifyKidsPin } from "@/lib/kids/pin";
import { kidsPinUnlockedCookieOptions } from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    pin?: string;
    confirmPin?: string;
    currentPin?: string;
    newPin?: string;
    confirmNewPin?: string;
  };

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

  const hasPin = Boolean(profile?.kids_pin_hash);

  if (body.newPin) {
    if (!hasPin && body.pin) {
      return NextResponse.json({ error: "Use pin field for initial setup." }, { status: 400 });
    }
    if (!isValidPin(body.newPin) || body.newPin !== body.confirmNewPin) {
      return NextResponse.json({ error: "New PIN must be 4 matching digits." }, { status: 400 });
    }
    if (hasPin) {
      const ok = await verifyKidsPin(body.currentPin ?? "", profile?.kids_pin_hash ?? null);
      if (!ok) {
        return NextResponse.json({ error: "Current PIN is incorrect." }, { status: 403 });
      }
    }
    const kids_pin_hash = await hashKidsPin(body.newPin);
    const { error } = await supabase.from("profiles").update({ kids_pin_hash }).eq("id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const cookieStore = await cookies();
    cookieStore.set(KIDS_PIN_UNLOCKED_COOKIE, "1", kidsPinUnlockedCookieOptions());
    return NextResponse.json({ ok: true });
  }

  if (!isValidPin(body.pin ?? "") || body.pin !== body.confirmPin) {
    return NextResponse.json({ error: "PIN must be 4 matching digits." }, { status: 400 });
  }

  if (hasPin) {
    return NextResponse.json({ error: "PIN already set. Use change PIN flow." }, { status: 400 });
  }

  const kids_pin_hash = await hashKidsPin(body.pin!);
  const { error } = await supabase.from("profiles").update({ kids_pin_hash }).eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const cookieStore = await cookies();
  cookieStore.set(KIDS_PIN_UNLOCKED_COOKIE, "1", kidsPinUnlockedCookieOptions());
  return NextResponse.json({ ok: true });
}

export async function PUT(request: Request) {
  return POST(request);
}
