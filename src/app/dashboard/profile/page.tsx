import { LogoutButton } from "@/app/dashboard/logout-button";
import { ViewAsPanel } from "@/app/dashboard/profile/view-as-panel";
import { TestOnboardingButton } from "@/components/onboarding/test-onboarding-button";
import { AccountCard } from "@/components/profile/account-card";
import { FriendsSummaryRow } from "@/components/profile/friends-summary-row";
import { PlacementReminderBanner } from "@/components/profile/placement-reminder-banner";
import { ProgressSummaryRow } from "@/components/profile/progress-summary-row";
import { UserAvatar } from "@/components/profile/user-avatar";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { isAdmin } from "@/lib/auth/admin";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import {
  formatMembershipPlanLabel,
  getCourseAccessContext,
  getUserUnlockedCourseIds,
  tiersFromUnlockedCourses,
} from "@/lib/membership/unlocked";
import { getDisplayName } from "@/lib/profile/display-name";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { loadFriendsProfileData } from "@/lib/friends/load-friends";
import { loadUserProgression, needsPlacementTestReminder } from "@/lib/progression/load-user-progression";
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
  const friendsData = await loadFriendsProfileData(supabase, user!.id);

  const realUnlockedCourseIds = access.viewAs?.active
    ? await getUserUnlockedCourseIds(supabase, user!.id)
    : access.unlockedCourseIds;
  const membershipLabel = formatMembershipPlanLabel(access.courses, realUnlockedCourseIds);

  const showAdminPanel = await canAccessAdminPanel(user!, supabase);
  const showTutorDashboard = await canAccessTutorDashboard(supabase, user!.id);

  const showPlacementReminder = needsPlacementTestReminder({
    placementCompleted: progression.placementCompleted,
    selfAssessedStartingTier: progression.selfAssessedTier,
    targetTier: progression.targetTier,
  });

  return (
    <div className={ui.page}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <UserAvatar
            profile={{
              full_name: profile?.full_name,
              preferred_name: profile?.preferred_name,
              avatar_url: profile?.avatar_url,
            }}
            level={progression.learnerLevel}
            size="lg"
            className="shrink-0 shadow-[0_4px_20px_-4px_rgba(24,24,27,0.12)] ring-4 ring-white"
          />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-medium text-zinc-900">
              {displayName || "Your profile"}
            </h1>
            <p className="mt-0.5 truncate text-sm text-zinc-500">{user?.email}</p>
            <p className="mt-1 text-sm font-medium tabular-nums text-violet-700">
              {progression.totalXp.toLocaleString()} lifetime XP
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/profile/edit"
          className="shrink-0 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Edit
        </Link>
      </div>

      <div className={`mt-8 ${ui.stackLoose}`}>
        {showPlacementReminder && <PlacementReminderBanner />}
        <ProgressSummaryRow progression={progression} />
        <FriendsSummaryRow friends={friendsData.friends} />
        <AccountCard membershipLabel={membershipLabel} isFreeOnly={access.isFreeOnly} />

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

        {showTutorDashboard && (
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-5">
            <p className="text-xs font-medium text-zinc-500">Tutor</p>
            <p className="mt-2 text-sm text-zinc-600">
              Mark attendance, review homework, unlock lessons, and manage your students.
            </p>
            <Link
              href="/dashboard/tutor"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
            >
              Open tutor dashboard
            </Link>
          </div>
        )}

        {showAdminPanel && (
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-5">
            <p className="text-xs font-medium text-zinc-500">Admin</p>
            <p className="mt-2 text-sm text-zinc-600">
              Manage courses, lessons, quizzes, and tutors.
            </p>
            <Link
              href="/admin/content"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
            >
              Open admin panel
            </Link>
            <Link
              href="/admin/content/help"
              className="mt-3 block text-sm font-medium text-violet-600 hover:text-violet-500"
            >
              Admin help articles
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
