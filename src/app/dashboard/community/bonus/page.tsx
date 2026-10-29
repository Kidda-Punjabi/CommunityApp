import { requestSessionSwitch } from "@/app/dashboard/community/actions";
import { CommunityPageHeader } from "@/components/community/community-page-header";
import { canJoinSession, formatClockShort, formatWeekdayDate } from "@/lib/community/format";
import { SubmitButton } from "@/components/ui/submit-button";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";

export default async function BonusSessionsPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const home = await loadCommunityHome(admin, user.id);
  const { data: sessions } = await admin
    .from("community_sessions")
    .select("id, title, weekday_label, start_time_local, timezone")
    .eq("is_active", true);
  const { data: upcoming } = await admin
    .from("community_session_occurrences")
    .select("id, session_id, starts_at, ends_at, status, meet_url")
    .gte("ends_at", new Date().toISOString())
    .neq("status", "cancelled")
    .order("starts_at");
  const nextBySession = new Map<string, NonNullable<typeof upcoming>[number]>();
  for (const row of upcoming ?? []) {
    if (!nextBySession.has(row.session_id)) nextBySession.set(row.session_id, row);
  }
  const main = (sessions ?? []).find((session) => session.id === home.mainSessionId);
  const others = (sessions ?? []).filter((session) => session.id !== home.mainSessionId);

  return (
    <div className={`${ui.page} font-[family-name:var(--font-community)]`}>
      <CommunityPageHeader title="Bonus sessions" />
      {main ? (
        <p className="mt-3 rounded-[20px] bg-[#F1ECFF] px-4 py-3 text-sm font-bold text-[#3B1A8C]">
          Your main session: {main.weekday_label} {formatClockShort(nextBySession.get(main.id)?.starts_at ?? new Date().toISOString(), home.timezone)}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {others.map((session) => {
          const next = nextBySession.get(session.id);
          const open = next ? next.status === "live" || canJoinSession(next.starts_at, next.ends_at) : false;
          return (
            <li key={session.id} className="rounded-[20px] bg-white p-4">
              <p className="font-heading font-extrabold text-[#1F1640]">{session.title}</p>
              <p className="text-sm text-[#4A3F66]">
                {next ? `${formatClockShort(next.starts_at, home.timezone)} your time · ${formatWeekdayDate(next.starts_at, home.timezone)}` : session.weekday_label}
              </p>
              {open && next?.meet_url ? (
                <a href={next.meet_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-14 items-center rounded-[18px] bg-[#7C3AED] px-5 text-sm font-bold text-white">Join</a>
              ) : null}
            </li>
          );
        })}
      </ul>
      <SwitchForm sessions={others.map((session) => ({ id: session.id, title: session.title }))} />
    </div>
  );
}

function SwitchForm({ sessions }: { sessions: { id: string; title: string }[] }) {
  return (
    <form
      className="mt-6 rounded-[20px] bg-white p-4"
      action={async (formData) => {
        "use server";
        await requestSessionSwitch(String(formData.get("sessionId") ?? ""), String(formData.get("reason") ?? ""));
      }}
    >
      <p className="font-heading font-extrabold text-[#1F1640]">Switch my main session</p>
      <select name="sessionId" className="mt-3 h-14 w-full rounded-[18px] border border-[#E7E0F4] px-3 text-[16px]">
        {sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
      </select>
      <input name="reason" placeholder="Reason, if you want to add one" className="mt-2 h-14 w-full rounded-[18px] border border-[#E7E0F4] px-3 text-[16px]" />
      <SubmitButton className="mt-3 h-14 w-full rounded-[18px] bg-[#5B21B6] text-sm font-bold text-white">Switch now</SubmitButton>
    </form>
  );
}
