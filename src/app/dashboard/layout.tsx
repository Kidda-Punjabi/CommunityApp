import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { KidsExitButton } from "@/components/kids/kids-exit-button";
import { KidSessionProvider } from "@/components/kids/kid-session-provider";
import { KidsShellRouteGuard } from "@/components/kids/kids-shell-route-guard";
import { TabNavProvider } from "@/components/navigation/tab-nav-provider";
import { LastPlayedGameTracker } from "@/components/games/last-played-tracker";
import { ActivityDateSync } from "@/components/activity-date-sync";
import { ViewAsBanner } from "@/components/view-as-banner";
import { FirstRunProvider } from "@/components/first-run/first-run-provider";
import { TourProvider } from "@/components/tours/tour-provider";
import { PointsToastProvider } from "@/components/points/points-toast-provider";
import {
  getCachedAuthSession,
  getCachedCourseAccess,
  getCachedOnboardingProfile,
} from "@/lib/supabase/cached-session";
import { loadPendingCourseResourceTours } from "@/app/dashboard/tours/actions";
import { AudioManagerProvider } from "@/lib/audio/audio-manager";
import { loadSoundSettings } from "@/lib/audio/load-sound-settings";
import { loadKidSession } from "@/lib/kids/session";
import { usesKidsShell } from "@/lib/kids/constants";
import { ui } from "@/lib/ui/styles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedAuthSession();

  if (!session) {
    redirect("/login");
  }

  const { supabase, user } = session;
  const [access, onboarding, kidSession, soundSettings, pendingCourseTours] =
    await Promise.all([
      getCachedCourseAccess(supabase, user),
      getCachedOnboardingProfile(supabase, user.id),
      loadKidSession(user.id),
      loadSoundSettings(supabase, user.id),
      loadPendingCourseResourceTours(user.id),
    ]);

  const kid = kidSession.activeKidProfile;
  const kidsShellActive = Boolean(kid && usesKidsShell(kid.age_tier));
  const showKidsExit =
    kid && !usesKidsShell(kid.age_tier) && !access.viewAs?.active;

  return (
    <FirstRunProvider
      hasSeenIntroPitch={onboarding.hasSeenIntroPitch}
      hasSeenOnboarding={onboarding.hasSeenOnboarding}
    >
      <TourProvider
        hasSeenOnboarding={onboarding.hasSeenOnboarding}
        hasSeenAppTour={onboarding.hasSeenAppTour}
        pendingCourseTours={pendingCourseTours}
        kidsShellActive={kidsShellActive}
      >
        <KidSessionProvider
          activeKidProfile={kid}
          hasPin={kidSession.hasPin}
          pinUnlocked={kidSession.pinUnlocked}
        >
          <AudioManagerProvider initialSettings={soundSettings}>
            <PointsToastProvider />
            <TabNavProvider>
              <KidsShellRouteGuard />
              <PullToRefresh>
                <div
                  className={`flex min-h-dvh flex-1 flex-col ${
                    kidsShellActive
                      ? "bg-gradient-to-b from-sky-100 via-violet-50 to-amber-50"
                      : ui.pageBg
                  }`}
                >
                  <ActivityDateSync />
                  <LastPlayedGameTracker />
                  {access.viewAs?.active && <ViewAsBanner label={access.viewAs.label} />}
                  {showKidsExit && <KidsExitButton />}
                  <div
                    className={
                      kidsShellActive
                        ? "relative isolate flex w-full flex-1 flex-col"
                        : `relative isolate mx-auto flex w-full max-w-lg flex-1 flex-col ${ui.pageBg} ${ui.navClearance}`
                    }
                  >
                    {children}
                  </div>
                  <BottomNav />
                </div>
              </PullToRefresh>
            </TabNavProvider>
          </AudioManagerProvider>
        </KidSessionProvider>
      </TourProvider>
    </FirstRunProvider>
  );
}
