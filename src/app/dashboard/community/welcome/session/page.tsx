import { SessionPicker, type SessionChoice } from "@/components/community/session-picker";
import { nextLocalStart } from "@/lib/community/format";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { redirect } from "next/navigation";

const NAMES: Record<string, string> = {
  "uk-wed": "Wednesday evening",
  "uk-sun": "Sunday morning",
};

const CITIES: Record<string, string> = {
  "uk-wed": "London",
  "uk-sun": "London",
  "au-wed": "Sydney",
  "au-fri": "Perth",
  "ca-sat": "Toronto",
  "ca-sun": "Vancouver",
};

export default async function WelcomeSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  const home = await loadCommunityHome(admin, user.id);
  if (home.level != null && home.mainSessionId) redirect("/dashboard/community");
  const params = await searchParams;
  const now = new Date();
  const [{ data: sessions }, { data: upcoming }] = await Promise.all([
    admin
      .from("community_sessions")
      .select("id, weekday, weekday_label, start_time_local, timezone, first_starts_on, starts_label")
      .eq("is_active", true),
    admin
      .from("community_session_occurrences")
      .select("session_id, starts_at")
      .gte("ends_at", now.toISOString())
      .neq("status", "cancelled")
      .order("starts_at"),
  ]);
  const nextStart = new Map<string, string>();
  for (const row of upcoming ?? []) {
    if (!nextStart.has(row.session_id)) nextStart.set(row.session_id, row.starts_at);
  }
  const choices: SessionChoice[] = (sessions ?? []).map((session) => {
    const listed = nextStart.get(session.id);
    const when = listed
      ? new Date(listed)
      : nextLocalStart(session.weekday, session.start_time_local, session.timezone, session.first_starts_on, now);
    return {
      id: session.id,
      weekdayLabel: session.weekday_label,
      startsAt: when.toISOString(),
      hostTimeZone: session.timezone,
      hostCity: CITIES[session.id] ?? "UK",
      running: !session.starts_label,
      cardName: NAMES[session.id] ?? null,
      firstStartsOn: session.first_starts_on,
    };
  });
  const order = ["uk-wed", "uk-sun", "au-wed", "au-fri", "ca-sat", "ca-sun"];
  choices.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return <SessionPicker sessions={choices} error={params.error ? "We couldn't save that session. Please try again." : undefined} />;
}
