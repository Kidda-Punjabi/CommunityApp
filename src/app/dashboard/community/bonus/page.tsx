import { canJoinSession, formatSessionClock } from "@/lib/community/format";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function BonusSessionsPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const home = await loadCommunityHome(admin, user.id);
  const { data } = await admin
    .from("community_session_occurrences")
    .select("id, session_id, starts_at, ends_at, status, meet_url, community_sessions(title, starts_label)")
    .gte("ends_at", new Date().toISOString())
    .neq("status", "cancelled")
    .order("starts_at")
    .limit(12);
  const rows = (data ?? []).filter((row) => row.session_id !== home.mainSessionId);
  return (
    <div className={ui.page}>
      <Link href="/dashboard/community" className="text-sm font-semibold text-violet-700">Community</Link>
      <h1 className="mt-2 font-heading text-2xl font-bold">Bonus sessions</h1>
      <p className="mt-2 text-sm text-zinc-600">These count as attended, and they don't change your main-session streak.</p>
      <ul className="mt-4 space-y-3">
        {rows.map((row) => {
          const session = Array.isArray(row.community_sessions) ? row.community_sessions[0] : row.community_sessions;
          const open = row.status === "live" || canJoinSession(row.starts_at, row.ends_at);
          return (
            <li key={row.id} className={ui.card}>
              <p className="font-semibold text-zinc-900">{session?.title}</p>
              <p className="text-sm text-zinc-600">{formatSessionClock(row.starts_at, home.timezone)} {session?.starts_label ? `· ${session.starts_label}` : ""}</p>
              <div className="mt-3 flex gap-2">
                {open && row.meet_url ? (
                  <a href={row.meet_url} target="_blank" rel="noreferrer" className={ui.btnPrimary}>Join</a>
                ) : null}
                {row.status === "live" ? (
                  <Link href={`/dashboard/community/check-in?occurrence=${row.id}`} className={ui.btnSecondary}>Check in</Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
