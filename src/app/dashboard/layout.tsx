import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Suspense } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { PendingOverlay } from "@/components/navigation/navigation-pending";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { KidSessionProvider } from "@/components/kids/kid-session-provider";
import { KidsShellNav } from "@/components/kids/kids-shell-nav";
import { KidsShellRouteGuard } from "@/components/kids/kids-shell-route-guard";
import { TabNavProvider } from "@/components/navigation/tab-nav-provider";
import { LastPlayedGameTracker } from "@/components/games/last-played-tracker";
import { ActivityDateSync } from "@/components/activity-date-sync";
import { PushPermissionPrompt } from "@/components/native/push-permission-prompt";
import { ViewAsBanner } from "@/components/view-as-banner";
import { FirstRunProvider } from "@/components/first-run/first-run-provider";
import { TourProvider } from "@/components/tours/tour-provider";
import { PointsToastProvider } from "@/components/points/points-toast-provider";
import {
  getCachedAuthSession,
  getCachedCourseAccess,
  getCachedOnboardingProfile,
} from "@/lib/supabase/cached-session";
import { AudioManagerProvider } from "@/lib/audio/audio-manager";
import { loadParentEntryFacts } from "@/lib/kids/load-parent-entry";
import { decideParentEntry } from "@/lib/kids/parent-entry";
import { loadKidSession } from "@/lib/kids/session";
import { isKidProfilePickerPath, KID_PROFILE_PICKER_PATH, usesKidsShell } from "@/lib/kids/constants";
import { planRedirect } from "@/lib/navigation/redirect-guard";
import { ui } from "@/lib/ui/styles";

async function ViewAsSlot() {
  const session = await getCachedAuthSession();
  if (!session) return null;
  const access = await getCachedCourseAccess(session.supabase, session.user);
  if (!access.viewAs?.active) return null;
  return <ViewAsBanner label={access.viewAs.label} />;
}

function redirectIfMoved(currentPath: string, destination: string, issued: { count: number }) {
  const next = planRedirect({
    currentPath,
    destination,
    redirectsAlreadyIssued: issued.count,
  });
  if (!next) return;
  issued.count += 1;
  redirect(next);
}

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
  const [kidSession, onboarding, headerList] = await Promise.all([
    loadKidSession(user.id),
    getCachedOnboardingProfile(supabase, user.id),
    headers(),
  ]);

  const kid = kidSession.activeKidProfile;
  const kidsShellActive = Boolean(kid && usesKidsShell(kid.age_tier));
  const pathname = headerList.get("x-pathname") ?? "";
  const isPickerScreen = isKidProfilePickerPath(pathname);
  const isWhoIsLearningFlow =
    isPickerScreen || pathname.startsWith("/dashboard/profile/kids/");
  const tutorShell = pathname.startsWith("/dashboard/tutor");
  const redirects = { count: 0 };
  const mayAskWhoIsLearning =
    !tutorShell &&
    onboarding.hasSeenOnboarding &&
    kidSession.hasKidProfiles &&
    !kidSession.pickedWhoThisSession &&
    !isWhoIsLearningFlow;
  let viewAsActive = false;

  if (mayAskWhoIsLearning) {
    const access = await getCachedCourseAccess(supabase, user);
    viewAsActive = Boolean(access.viewAs?.active);
    if (!viewAsActive && !kid) {
      const facts = await loadParentEntryFacts(supabase, user.id);
      const entry = decideParentEntry({
        kidCount: facts.kidCount,
        hasOwnAdultCourse: facts.hasOwnAdultCourse,
        pickedWhoThisSession: false,
        activeKidProfileId: null,
        viewAsActive: false,
      });
      if (entry === "enter-kid") redirectIfMoved(pathname, "/api/kids/enter-default", redirects);
      if (entry === "picker") redirectIfMoved(pathname, KID_PROFILE_PICKER_PATH, redirects);
    }
  }

  const shouldPickWhoIsLearning = mayAskWhoIsLearning && kidSession.hasPin && !viewAsActive;

  if (shouldPickWhoIsLearning) {
    redirectIfMoved(pathname, KID_PROFILE_PICKER_PATH, redirects);
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
        pendingCourseTours={[]}
        kidSessionActive={Boolean(kid)}
      >
        <KidSessionProvider
          activeKidProfile={kid}
          hasPin={kidSession.hasPin}
          pinUnlocked={kidSession.pinUnlocked}
          hasKidProfiles={kidSession.hasKidProfiles}
          parentInitial={parentInitial}
        >
          <AudioManagerProvider>
            <PointsToastProvider />
            <TabNavProvider>
              <KidsShellRouteGuard />
              <PullToRefresh>
                <div
                  className={`flex min-h-dvh flex-1 flex-col ${
                    kidsShellActive
                      ? "bg-gradient-to-b from-sky-100 via-violet-50 to-amber-50"
                      : tutorShell
                        ? "overflow-x-clip bg-violet-50/40"
                        : ui.pageBg
                  }`}
                >
                  <ActivityDateSync />
                  <PushPermissionPrompt />
                  <LastPlayedGameTracker />
                  <Suspense fallback={null}>
                    <ViewAsSlot />
                  </Suspense>
                  <div
                    className={
                      kidsShellActive
                        ? `relative isolate flex w-full flex-1 flex-col ${ui.navClearance}`
                        : `relative isolate mx-auto flex w-full max-w-lg flex-1 flex-col ${
                          tutorShell ? "" : ui.pageBg
                        } ${ui.navClearance}`
                    }
                  >
                    {children}
                    <PendingOverlay />
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
