import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { BottomNav } from "@/components/bottom-nav";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { KidSessionProvider } from "@/components/kids/kid-session-provider";
import { KidsShellNav } from "@/components/kids/kids-shell-nav";
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
import { isKidProfilePickerPath, usesKidsShell } from "@/lib/kids/constants";
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
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const isPickerScreen = isKidProfilePickerPath(pathname);
  const isWhoIsLearningFlow =
    isPickerScreen || pathname.startsWith("/dashboard/profile/kids/");
  const shouldPickWhoIsLearning =
    onboarding.hasSeenOnboarding &&
    kidSession.hasKidProfiles &&
    kidSession.hasPin &&
    !kidSession.pickedWhoThisSession &&
    !isWhoIsLearningFlow &&
    !access.viewAs?.active;

  if (shouldPickWhoIsLearning) {
    redirect("/dashboard/profile/kids");
  }

  const isFirstRunPicker = isPickerScreen && !kidSession.pickedWhoThisSession;
  if (isFirstRunPicker) {
    return <div className={`flex min-h-dvh flex-col ${ui.pageBg}`}>{children}</div>;
  }

  const parentInitial = (user.email?.trim().charAt(0) ?? "P").toUpperCase();

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
          hasKidProfiles={kidSession.hasKidProfiles}
          parentInitial={parentInitial}
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
                  <div
                    className={
                      kidsShellActive
                        ? `relative isolate flex w-full flex-1 flex-col ${ui.navClearance}`
                        : `relative isolate mx-auto flex w-full max-w-lg flex-1 flex-col ${ui.pageBg} ${ui.navClearance}`
                    }
                  >
                    {children}
                  </div>
                  {kidsShellActive && kid ? (
                    <KidsShellNav ageTier={kid.age_tier} />
                  ) : (
                    <BottomNav />
                  )}
                </div>
              </PullToRefresh>
            </TabNavProvider>
          </AudioManagerProvider>
        </KidSessionProvider>
      </TourProvider>
    </FirstRunProvider>
  );
}
