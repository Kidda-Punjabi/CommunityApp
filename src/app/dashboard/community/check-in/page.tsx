import { CheckInForm } from "@/components/community/check-in-form";
import { CommunityPageHeader } from "@/components/community/community-page-header";
import { levelFillVar } from "@/lib/community/levels";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ occurrence?: string }>;
}) {
  await requireNoKidCommunityAccess();
  const { occurrence } = await searchParams;
  const admin = createServiceRoleClient();
  const { data: row } = occurrence
    ? await admin
        .from("community_session_occurrences")
        .select("id, status, community_sessions(title)")
        .eq("id", occurrence)
        .maybeSingle()
    : { data: null };

  const { data: checkins } = occurrence
    ? await admin
        .from("community_checkins")
        .select("user_id, profiles(full_name, kidda_level)")
        .eq("occurrence_id", occurrence)
    : { data: [] };

  const session = row && (Array.isArray(row.community_sessions) ? row.community_sessions[0] : row.community_sessions);

  return (
    <div className={`${ui.page} !py-4`}>
      <CommunityPageHeader title="Check in" />
      <p className="mt-1 text-sm text-zinc-600">{session?.title ?? "Community session"}</p>
      {row?.status === "live" && occurrence ? (
        <CheckInForm occurrenceId={occurrence} />
      ) : (
        <p className="mt-4 text-sm text-zinc-600">Check-in opens when the session is live.</p>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        {(checkins ?? []).map((checkin) => {
          const profile = Array.isArray(checkin.profiles) ? checkin.profiles[0] : checkin.profiles;
          const name = profile?.full_name || "Member";
          const level = profile?.kidda_level ?? null;
          return (
            <span
              key={checkin.user_id}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold"
              style={level == null ? undefined : { boxShadow: `0 0 0 3px ${levelFillVar(level)}` }}
              title={name}
            >
              {name.slice(0, 1)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
