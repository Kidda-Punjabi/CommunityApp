import { retryCalendarInvite } from "@/app/admin/community/actions";
import { requireCommunityStaff } from "@/lib/community/member-guard";
import { ui } from "@/lib/ui/styles";

export default async function CalendarInvitesPage() {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return null;
  const { data } = await staff.admin
    .from("community_memberships_meta")
    .select("user_id, main_session_id, calendar_invite_error, profiles(full_name)")
    .eq("calendar_invite_status", "failed");
  return (
    <div className={ui.page}>
      <h1 className="font-heading text-2xl font-bold">Calendar invite failed</h1>
      <ul className="mt-4 space-y-3">
        {(data ?? []).map((row) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return (
            <li key={row.user_id} className={ui.card}>
              <p className="font-semibold">{profile?.full_name ?? "Member"}</p>
              <p className="text-sm text-zinc-600">{row.main_session_id}</p>
              <p className="text-sm text-red-700">{row.calendar_invite_error}</p>
              <form action={async () => { "use server"; await retryCalendarInvite(row.user_id); }} className="mt-3">
                <button type="submit" className={ui.btnPrimary}>Retry</button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}