import { retryAdminCoverAssignment } from "@/app/admin/cover-requests/actions";
import { requireAdminFromActions } from "@/app/admin/content/actions";
import { getDisplayName } from "@/lib/profile/display-name";
import { ui } from "@/lib/ui/styles";

export default async function AdminCoverRequestsPage() {
  const supabase = await requireAdminFromActions();
  const { data, error } = await supabase
    .from("tutor_cover_requests")
    .select(
      "id, status, reason, assigned_at, decision_deadline, decided_at, decline_reason, attempt_count, requesting_tutor_id, assigned_tutor_id, tutor_scheduled_sessions(id, title, starts_at, ends_at)"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const tutorIds = [
    ...new Set(
      (data ?? []).flatMap((row) =>
        [row.requesting_tutor_id, row.assigned_tutor_id].filter(Boolean)
      )
    ),
  ] as string[];
  const { data: profiles } =
    tutorIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, preferred_name")
          .in("id", tutorIds)
      : { data: [] };
  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.id, getDisplayName(profile) ?? "Tutor"] as const)
  );

  return (
    <div className={ui.page}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Cover requests</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Review auto-assigned cover status and retry assignments that still need admin help.
        </p>
      </div>

      {error ? <p className="text-sm text-rose-600">{error.message}</p> : null}

      <div className="space-y-4">
        {(data ?? []).map((row) => {
          const session = Array.isArray(row.tutor_scheduled_sessions)
            ? row.tutor_scheduled_sessions[0]
            : row.tutor_scheduled_sessions;
          return (
            <div key={row.id} className={ui.cardBordered}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900">{session?.title ?? "Lesson"}</p>
                  {session?.starts_at && session?.ends_at ? (
                    <p className="mt-1 text-sm text-zinc-500">
                      {new Date(session.starts_at).toLocaleString("en-GB")} to{" "}
                      {new Date(session.ends_at).toLocaleTimeString("en-GB", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
                  {row.status}
                </span>
              </div>

              <div className="mt-3 space-y-1 text-sm text-zinc-600">
                <p>Requesting tutor: {nameById.get(row.requesting_tutor_id) ?? "Tutor"}</p>
                <p>Assigned tutor: {row.assigned_tutor_id ? (nameById.get(row.assigned_tutor_id) ?? "Tutor") : "None yet"}</p>
                <p>Attempts: {row.attempt_count ?? 0}</p>
                {row.reason ? <p>Reason: {row.reason}</p> : null}
                {row.decline_reason ? <p>Decline reason: {row.decline_reason}</p> : null}
                {row.decision_deadline ? (
                  <p>Decision deadline: {new Date(row.decision_deadline).toLocaleString("en-GB")}</p>
                ) : null}
              </div>

              {row.status === "needs_admin" ? (
                <form
                  action={async () => {
                    "use server";
                    await retryAdminCoverAssignment(row.id);
                  }}
                  className="mt-4"
                >
                  <button type="submit" className={ui.btnPrimary}>
                    Retry auto-assignment
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
