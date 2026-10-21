import { addCheckIn, endSession, overrideWeek, startSession } from "@/app/admin/community/actions";
import { BreakoutHost } from "@/components/community/breakout-host";
import { LiveCheckins } from "@/components/community/live-checkins";
import { bandForLevel, bandLabel, levelFillVar, levelInkVar } from "@/lib/community/levels";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function CommunityTodayPage() {
  const admin = createServiceRoleClient();
  const until = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
  const { data: occurrences } = await admin
    .from("community_session_occurrences")
    .select("id, session_id, starts_at, status, checkin_code, week_number, week_number_override, community_sessions(title)")
    .gte("starts_at", new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())
    .lte("starts_at", until)
    .neq("status", "cancelled")
    .order("starts_at");

  const live = (occurrences ?? []).find((row) => row.status === "live") ?? occurrences?.[0];
  const { data: checkins } = live
    ? await admin
        .from("community_checkins")
        .select("user_id, checked_in_at, is_late, added_by_tutor, profiles(full_name, kidda_level)")
        .eq("occurrence_id", live.id)
        .order("checked_in_at")
    : { data: [] };
  const checkedIds = new Set((checkins ?? []).map((row) => row.user_id as string));
  const { data: pods } = live
    ? await admin.from("pods").select("id, name, pod_members(user_id, profiles(full_name, kidda_level))").eq("session_id", live.session_id)
    : { data: [] };
  const missing = (pods ?? []).flatMap((pod) =>
    ((pod.pod_members ?? []) as { user_id: string; profiles: { full_name: string | null; kidda_level: number | null } | { full_name: string | null; kidda_level: number | null }[] | null }[])
      .filter((member) => !checkedIds.has(member.user_id))
      .map((member) => {
        const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
        return { userId: member.user_id, name: profile?.full_name || "Member", pod: pod.name as string };
      })
  );

  const grouped = new Map<string, typeof checkins>();
  for (const checkin of checkins ?? []) {
    const profile = Array.isArray(checkin.profiles) ? checkin.profiles[0] : checkin.profiles;
    const band = bandLabel(bandForLevel(profile?.kidda_level ?? 0));
    const list = grouped.get(band) ?? [];
    list.push(checkin);
    grouped.set(band, list);
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-bold text-zinc-900">Community today</h1>
      {(occurrences ?? []).map((occurrence) => {
        const session = Array.isArray(occurrence.community_sessions) ? occurrence.community_sessions[0] : occurrence.community_sessions;
        const week = occurrence.week_number_override ?? occurrence.week_number;
        return (
          <section key={occurrence.id} className={ui.card}>
            <p className="font-semibold text-zinc-900">{session?.title}</p>
            <p className="text-sm text-zinc-500">{new Date(occurrence.starts_at).toLocaleString("en-GB", { timeZone: "Europe/London" })} · Week {week} · {occurrence.status}</p>
            {occurrence.status === "scheduled" ? (
              <form action={async () => { "use server"; await startSession(occurrence.id); }} className="mt-3">
                <button type="submit" className={ui.btnPrimary}>Start session</button>
              </form>
            ) : null}
            {occurrence.status === "live" ? (
              <div className="mt-3">
                <p className="font-heading text-4xl font-bold tracking-[0.3em] text-zinc-900">{occurrence.checkin_code}</p>
                <Link href={`/admin/community/today/code?occurrence=${occurrence.id}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-violet-700">
                  Show full screen to share
                </Link>
                <form action={async () => { "use server"; await endSession(occurrence.id); }} className="mt-3">
                  <button type="submit" className={ui.btnSecondary}>End session</button>
                </form>
              </div>
            ) : null}
            <form
              action={async (formData) => {
                "use server";
                await overrideWeek(occurrence.id, Number(formData.get("week")));
              }}
              className="mt-3 flex items-center gap-2"
            >
              <label className="text-sm text-zinc-600" htmlFor={`week-${occurrence.id}`}>Week</label>
              <input id={`week-${occurrence.id}`} name="week" type="number" min={1} max={24} defaultValue={week} className="h-11 w-20 rounded-xl border border-zinc-200 px-2 text-[16px]" />
              <button type="submit" className={ui.btnSecondary}>Save</button>
            </form>
          </section>
        );
      })}

      {live?.status === "live" ? <LiveCheckins occurrenceId={live.id} /> : null}
      {live?.status === "live" ? <BreakoutHost occurrenceId={live.id} /> : null}

      {[...grouped.entries()].map(([band, rows]) => (
        <section key={band}>
          <h2 className="font-heading text-lg font-semibold">{band}</h2>
          <ul className="mt-2 space-y-2">
            {(rows ?? []).map((row) => {
              const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
              const level = profile?.kidda_level ?? 0;
              return (
                <li key={row.user_id} className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-white px-3">
                  <span className="text-sm font-medium">{profile?.full_name || "Member"}</span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: levelFillVar(level), color: levelInkVar(level) }}>
                    Level {level}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(row.checked_in_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    {row.is_late ? " · Late" : ""}
                    {row.added_by_tutor ? " · Added" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {live?.status === "live" ? (
        <section className={ui.card}>
          <h2 className="font-heading text-lg font-semibold">Add someone</h2>
          <form
            action={async (formData) => {
              "use server";
              await addCheckIn(live.id, String(formData.get("email") ?? ""));
            }}
            className="mt-3 flex gap-2"
          >
            <input name="email" type="email" required placeholder="Email" className="h-11 flex-1 rounded-xl border border-zinc-200 px-3 text-[16px]" />
            <button type="submit" className={ui.btnPrimary}>Add</button>
          </form>
          <h2 className="mt-6 font-heading text-lg font-semibold">Not here yet</h2>
          <ul className="mt-2 space-y-2">
            {missing.map((member) => (
              <li key={member.userId} className="text-sm text-zinc-700">{member.name} · {member.pod}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
