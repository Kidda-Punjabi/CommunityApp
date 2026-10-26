import { CommunityTab } from "@/components/community/community-tab";
import { CheckInPanel } from "@/components/community/check-in-ui";
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
import { pendingSessionFeedback } from "@/lib/community/session-feedback";
import { syncStripePurchasesForUser } from "@/lib/stripe/sync-purchases";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";
import { headers } from "next/headers";

const MEMBERS_ONLY = "Community sessions are only for Kidda Community members.";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ checkin?: string }>;
}) {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  let allowed = await memberHasCommunity(admin, user.id);
  if (!allowed && user.email) {
    try {
      await syncStripePurchasesForUser(user.id, user.email);
      allowed = await memberHasCommunity(admin, user.id);
    } catch (error) {
      console.error("[community] purchase sync failed:", error instanceof Error ? error.message : error);
    }
  }
  const native = isNativeAppRequest(await headers());
  const params = await searchParams;

  return (
    <div className={`${ui.page} community-fit !flex !h-[calc(100dvh-var(--kidda-nav-clearance))] !max-h-[calc(100dvh-var(--kidda-nav-clearance))] !min-h-0 !flex-none !flex-col !overflow-hidden !px-5 !pb-0 !pt-[max(0.25rem,env(safe-area-inset-top,0px))]`}>
      <h1 className="mb-2 shrink-0 font-heading text-[28px] font-bold leading-8 tracking-tight text-zinc-900">Community</h1>
      {allowed ? (
        <CommunityHome userId={user.id} openCheckIn={params.checkin === "1"} />
      ) : (
        <section className={ui.card}>
          <p className="text-sm text-zinc-700">{native ? "This isn't on your account." : MEMBERS_ONLY}</p>
        </section>
      )}
    </div>
  );
}

async function CommunityHome({ userId, openCheckIn }: { userId: string; openCheckIn: boolean }) {
  const admin = createServiceRoleClient();
  const [home, room] = await Promise.all([
    loadCommunityHome(admin, userId),
    loadMemberRoom(admin, userId),
  ]);
  const onboarded = Boolean(home.mainSessionId && home.level != null);
  if (room) return <LiveRoom view={room} userId={userId} needsOnboarding={!onboarded} />;

  const live = await liveCheckInFlags(admin, userId, home.next?.id ?? null);
  if (!onboarded) {
    if (!live.anyLive) {
      const { redirect } = await import("next/navigation");
      redirect("/dashboard/community/welcome");
    }
    return (
      <section className="rounded-[24px] bg-[#5B21B6] p-4 text-white">
        <h2 className="font-heading text-xl font-extrabold">Check in</h2>
        <div className="mt-3 rounded-[20px] bg-white p-4 text-[#1F1640]">
          <CheckInPanel />
        </div>
      </section>
    );
  }

  const [view, unread, board, feedback] = await Promise.all([
    loadLevelView(admin, userId),
    loadForumUnread(admin, userId),
    loadLeaderboard(admin, getCurrentWeekStart(), userId),
    pendingSessionFeedback(admin, userId).catch((error) => {
      console.error("[community] feedback prompt failed", error);
      return null;
    }),
  ]);
  return (
    <>
    {feedback ? (
      <Link
        href={`/dashboard/community/feedback/${feedback.formSessionId}`}
        className="mb-3 flex items-center justify-between gap-3 rounded-[24px] bg-[#5B21B6] px-4 py-4 text-white"
      >
        <span>
          <span className="block font-heading text-lg font-extrabold">How was {feedback.title}?</span>
          <span className="block text-sm text-violet-100">Three quick ratings. It helps Arsh plan next week.</span>
        </span>
        <span className="shrink-0 rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-[#5B21B6]">Give feedback</span>
      </Link>
    ) : null}
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
      openCheckIn={openCheckIn}
      liveIds={live.liveIds}
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
    </>
  );
}
