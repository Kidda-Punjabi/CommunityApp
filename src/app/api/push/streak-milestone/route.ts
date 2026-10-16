import { NextResponse } from "next/server";
import { loadKidSession } from "@/lib/kids/session";
import { isStreakMilestone } from "@/lib/push/policy";
import { sendPush } from "@/lib/push/send";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { client } = tryCreateServiceRoleClient();
  if (!client) return NextResponse.json({ ok: false });

  const kid = await loadKidSession(user.id);
  const kidProfileId = kid.activeKidProfile?.id ?? null;
  let query = client
    .from("user_streaks")
    .select("current_streak")
    .eq("user_id", user.id);
  query = kidProfileId ? query.eq("kid_profile_id", kidProfileId) : query.is("kid_profile_id", null);
  const { data } = await query.maybeSingle();
  const streak = Number(data?.current_streak ?? 0);
  if (!isStreakMilestone(streak)) return NextResponse.json({ ok: true, sent: false });

  const result = await sendPush({
    userId: user.id,
    kidProfileId,
    type: "S3",
    refKey: `${kidProfileId ?? user.id}:${streak}`,
    title: `${streak}-day streak!`,
    body: `You've practised Punjabi ${streak} days in a row. Shabash!`,
    url: "/dashboard/profile",
  });
  return NextResponse.json({ ok: true, result });
}
