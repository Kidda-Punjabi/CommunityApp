import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isKidAgeTier,
  KID_PROFILE_COOKIE,
  usesKidsShell,
} from "@/lib/kids/constants";
import { kidHomeHref } from "@/lib/kids/load-kid-content";
import {
  isKidsPinUnlocked,
  kidProfileCookieOptions,
  syncKidSessionContext,
} from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { kidProfileId } = (await request.json()) as { kidProfileId?: string };

  if (!kidProfileId) {
    return NextResponse.json({ error: "kidProfileId required." }, { status: 400 });
  }

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
    .maybeSingle();

  if (profile?.kids_pin_hash && !(await isKidsPinUnlocked())) {
    return NextResponse.json({ error: "Enter your PIN to switch profiles." }, { status: 403 });
  }

  const { data: kid } = await supabase
    .from("kid_profiles")
    .select("*")
    .eq("id", kidProfileId)
    .eq("parent_user_id", user.id)
    .single();

  if (!kid || !isKidAgeTier(kid.age_tier)) {
    return NextResponse.json({ error: "Kid profile not found." }, { status: 404 });
  }

  const cookieStore = await cookies();
  cookieStore.set(KID_PROFILE_COOKIE, kidProfileId, kidProfileCookieOptions());
  await syncKidSessionContext(user.id, kidProfileId);

  const redirectTo = usesKidsShell(kid.age_tier)
    ? "/dashboard/kids"
    : kidHomeHref(kid.age_tier);

  return NextResponse.json({ ok: true, redirectTo, ageTier: kid.age_tier });
}

export async function DELETE() {
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
    .maybeSingle();

  if (profile?.kids_pin_hash && !(await isKidsPinUnlocked())) {
    return NextResponse.json({ error: "Enter your PIN to switch profiles." }, { status: 403 });
  }

  const cookieStore = await cookies();
  const activeKid = cookieStore.get(KID_PROFILE_COOKIE)?.value?.trim();
  if (activeKid) {
    return NextResponse.json(
      { error: "Enter your PIN to return to the parent account." },
      { status: 403 }
    );
  }

  await syncKidSessionContext(user.id, null);

  return NextResponse.json({ ok: true, redirectTo: "/dashboard/home" });
}
