import { NextResponse } from "next/server";
import { awardKidSticker, logKidActivity } from "@/lib/kids/award-sticker";
import { getActiveKidProfileIdFromCookie } from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { activityType, metadata } = (await request.json()) as {
    activityType?: string;
    metadata?: Record<string, unknown>;
  };

  if (!activityType?.trim()) {
    return NextResponse.json({ error: "activityType required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const kidProfileId = await getActiveKidProfileIdFromCookie();
  if (!kidProfileId) {
    return NextResponse.json({ error: "No active kid profile." }, { status: 400 });
  }

  const { data: kid } = await supabase
    .from("kid_profiles")
    .select("id, age_tier")
    .eq("id", kidProfileId)
    .eq("parent_user_id", user.id)
    .single();

  if (!kid) {
    return NextResponse.json({ error: "Kid profile not found." }, { status: 404 });
  }

  await logKidActivity(supabase, kidProfileId, activityType, metadata ?? {});

  let sticker = null;
  if (kid.age_tier === "pre_reader" || kid.age_tier === "early_reader") {
    sticker = await awardKidSticker(supabase, kidProfileId);
  }

  return NextResponse.json({ ok: true, sticker });
}
