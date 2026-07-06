import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  isKidAgeTier,
  KID_PROFILE_COOKIE,
  usesKidsShell,
} from "@/lib/kids/constants";
import { kidProfileCookieOptions, syncKidSessionContext } from "@/lib/kids/session";
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
    : "/dashboard/home";

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

  const cookieStore = await cookies();
  cookieStore.delete(KID_PROFILE_COOKIE);
  await syncKidSessionContext(user.id, null);

  return NextResponse.json({ ok: true });
}
