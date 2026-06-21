import { LogoutButton } from "@/app/dashboard/logout-button";
import { ViewAsPanel } from "@/app/dashboard/profile/view-as-panel";
import { TestOnboardingButton } from "@/components/onboarding/test-onboarding-button";
import { FriendsSection } from "@/components/profile/friends-section";
import { InviteFriendsCard } from "@/components/profile/invite-friends-card";
import { ProgressionCard } from "@/components/profile/progression-card";
import { WeeklyPointsCard } from "@/components/profile/weekly-points-card";
import { UserAvatar } from "@/components/profile/user-avatar";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { isAdmin } from "@/lib/auth/admin";
import { loadViewerWeeklyPoints } from "@/lib/leaderboard/load-viewer-weekly-points";
import { getCurrentWeekStart } from "@/lib/leaderboard/week";
import {
  formatUnlockedCourseNames,
  getCourseAccessContext,
  tiersFromUnlockedCourses,
} from "@/lib/membership/unlocked";
import { getDisplayName } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { loadReferralProfileData } from "@/lib/referrals/load-referrals";
import { loadFriendsProfileData } from "@/lib/friends/load-friends";
import { loadUserProgression } from "@/lib/progression/load-user-progression";
import { createClient } from "@/lib/supabase/server";
import { syncStripePurchasesForUser } from "@/lib/stripe/sync-purchases";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await loadEditableProfile(supabase, user!.id);

  const displayName = getDisplayName(profile);

  if (user?.email) {
    try {
      await syncStripePurchasesForUser(user.id, user.email);
    } catch {
      // Best-effort Stripe sync.
    }
  }

  const access = await getCourseAccessContext(supabase, user!);
  const progression = await loadUserProgression(supabase, user!.id);
  const currentWeekStart = getCurrentWeekStart();
  const weeklyPoints = await loadViewerWeeklyPoints(supabase, user!.id, currentWeekStart);
  const referralData = await loadReferralProfileData(supabase, user!.id);
  const friendsData = await loadFriendsProfileData(supabase, user!.id);

  const membershipLabel = access.viewAs?.active
    ? `Testing: ${access.viewAs.label}`
    : formatUnlockedCourseNames(access.courses, access.unlockedCourseIds);

  const showAdminPanel = await canAccessAdminPanel(user!);

  return (
    <div className={ui.page}>
      <div className="text-center">
        <div className="mx-auto w-fit shadow-[0_4px_20px_-4px_rgba(24,24,27,0.12)] ring-4 ring-white">
          <UserAvatar
            profile={{
              full_name: profile?.full_name,
              preferred_name: profile?.preferred_name,
              avatar_url: profile?.avatar_url,
            }}
            level={progression.learnerLevel}
            size="lg"
          />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-zinc-900">
          Profile
        </h1>
        {displayName && (
          <p className="mt-1 text-lg font-medium text-zinc-700">{displayName}</p>
        )}
        <p className="mt-1 text-sm text-zinc-500">{user?.email}</p>
        <Link href="/dashboard/profile/edit" className={`mt-5 ${ui.btnSecondary}`}>
          Edit profile
        </Link>
        <Link
          href="/dashboard/profile/notifications"
          className="mt-2 inline-block text-sm font-medium text-zinc-500 hover:text-violet-600"
        >
          Notification settings
        </Link>
      </div>

      <div className={`mt-10 ${ui.stackLoose}`}>
        <WeeklyPointsCard points={weeklyPoints} weekStart={currentWeekStart} />
        <FriendsSection
          friends={friendsData.friends}
          requests={friendsData.requests}
          unavailable={friendsData.unavailable}
        />
        <InviteFriendsCard
          shareUrl={referralData.shareUrl}
          referralCode={referralData.referralCode}
          referrals={referralData.referrals}
          unavailableReason={referralData.unavailableReason}
        />
        <ProgressionCard progression={progression} />

        <div className={ui.card}>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Membership
          </p>
          <p className="mt-1 text-lg font-semibold text-violet-600">{membershipLabel}</p>
          <Link
            href="/dashboard/membership"
            className="mt-3 inline-block text-sm font-semibold text-violet-600 hover:text-violet-500"
          >
            {access.isFreeOnly ? "Browse courses →" : "Buy another course →"}
          </Link>
        </div>

        {isAdmin(user) && (
          <ViewAsPanel
            initialTiers={
              access.viewAs?.active
                ? access.viewAs.tiers
                : tiersFromUnlockedCourses(access.courses, access.unlockedCourseIds)
            }
            isOverrideActive={Boolean(access.viewAs?.active)}
          />
        )}

        {showAdminPanel && (
          <div className="rounded-3xl bg-violet-50 p-5 shadow-[0_4px_24px_-6px_rgba(124,58,237,0.1)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              Admin
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              Manage courses, lessons, quizzes, tutors, and teachers.
            </p>
            <Link href="/admin/content" className={`mt-4 ${ui.btnPrimary}`}>
              Open admin panel
            </Link>
            <TestOnboardingButton />
          </div>
        )}
      </div>

      <div className="mt-auto pt-10">
        <LogoutButton />
      </div>
    </div>
  );
}
