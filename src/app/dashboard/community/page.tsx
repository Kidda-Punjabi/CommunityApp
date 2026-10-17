import { CommunityTab } from "@/components/community/community-tab";
import { liveCheckInFlags } from "@/lib/community/check-in-by-code";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { loadLevelView } from "@/lib/community/level-view";
import { loadForumUnread } from "@/lib/forum/unread";
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
    <div className={`${ui.page} !flex !h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] !flex-col !overflow-hidden !py-2`}>
      <h1 className="mb-3 font-heading text-2xl font-bold tracking-tight text-zinc-900">Community</h1>
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
  const [home, view, unread] = await Promise.all([
    loadCommunityHome(admin, userId),
    loadLevelView(admin, userId),
    loadForumUnread(admin, userId),
  ]);
  if (!home.mainSessionId || home.level == null) redirect("/dashboard/community/welcome");
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
    />
  );
}
