import { approveSessionSwitch } from "@/app/admin/community/actions";
import { requireCommunityStaff } from "@/lib/community/member-guard";
import { ui } from "@/lib/ui/styles";

export default async function CommunitySwitchesPage() {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return null;
  const { data } = await staff.admin
    .from("community_session_switch_requests")
    .select("id, user_id, from_session_id, to_session_id, reason, created_at, profiles(full_name)")
    .eq("status", "pending")
    .order("created_at");
  return (
    <div className={ui.page}>
      <h1 className="font-heading text-2xl font-bold">Session switch requests</h1>
      <ul className="mt-4 space-y-3">
        {(data ?? []).map((row) => {
          const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
          return (
            <li key={row.id} className={ui.card}>
              <p className="font-semibold">{profile?.full_name ?? "Member"}</p>
              <p className="text-sm text-zinc-600">{row.from_session_id} to {row.to_session_id}</p>
              {row.reason ? <p className="text-sm text-zinc-600">{row.reason}</p> : null}
              <form action={async () => { "use server"; await approveSessionSwitch(row.id); }} className="mt-3">
                <button type="submit" className={ui.btnPrimary}>Approve</button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
