import { CommunityTab } from "@/components/community/community-tab";
import { LiveRoom } from "@/components/community/live-room";
import { loadMemberRoom } from "@/lib/community/breakout";
import { liveCheckInFlags } from "@/lib/community/check-in-by-code";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { loadLevelView } from "@/lib/community/level-view";
import { loadForumUnread } from "@/lib/forum/unread";
import { loadLeaderboard } from "@/lib/leaderboard/load-leaderboard";
import { getCurrentWeekStart } from "@/lib/leaderboard/week";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { isNativeAppRequest } from "@/lib/native/platform";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function CommunityPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  const allowed = await memberHasCommunity(admin, user.id);
  const native = isNativeAppRequest(await headers());

  return (
    <div className={`${ui.page} community-fit !flex !h-[calc(100dvh-var(--kidda-nav-clearance))] !max-h-[calc(100dvh-var(--kidda-nav-clearance))] !min-h-0 !flex-none !flex-col !overflow-hidden !px-5 !pb-0 !pt-[max(0.25rem,env(safe-area-inset-top,0px))]`}>
      <h1 className="mb-2 shrink-0 font-heading text-[28px] font-bold leading-8 tracking-tight text-zinc-900">Community</h1>
      {allowed ? (
        <CommunityHome userId={user.id} />
      ) : (
        <section className={ui.card}>
          <p className="text-sm text-zinc-700">
            {native ? "This isn't on your account." : "Community sessions are for Kidda Community members."}
          </p>
          <Link href="/dashboard/community/forum" className="mt-4 inline-flex text-sm font-semibold text-violet-700">
            Community forum
          </Link>
        </section>
      )}
    </div>
  );
}

async function CommunityHome({ userId }: { userId: string }) {
  const admin = createServiceRoleClient();
  const [home, view, unread, board, room] = await Promise.all([
    loadCommunityHome(admin, userId),
    loadLevelView(admin, userId),
    loadForumUnread(admin, userId),
    loadLeaderboard(admin, getCurrentWeekStart(), userId),
    loadMemberRoom(admin, userId),
  ]);
  if (!home.mainSessionId || home.level == null) redirect("/dashboard/community/welcome");
  if (room) return <LiveRoom view={room} userId={userId} />;
  const live = await liveCheckInFlags(admin, userId, home.next?.id ?? null);
  return (
    <CommunityTab
      home={home}
      earned={view?.done ?? 0}
      target={view && view.level < 9 ? view.goal : null}
      percent={view?.percent ?? 0}
      checkReady={Boolean(view?.unlocked)}
      cooldownUntil={view?.cooldownUntil ?? null}
      fresh={unread.fresh}
      replies={unread.replies}
      anyLive={live.anyLive}
      checkedIntoNext={live.checkedIntoNext}
      leaderboard={{
        top: board.entries.slice(0, 3).map((entry) => ({
          userId: entry.userId,
          name: entry.displayName,
          points: entry.points,
          rank: entry.rank ?? 0,
        })),
        youRank: board.viewerRow.rank,
        youPoints: board.viewerRow.points,
      }}
    />
  );
}
