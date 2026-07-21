import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { KidsExitButton } from "@/components/kids/kids-exit-button";
import { KidSessionProvider } from "@/components/kids/kid-session-provider";
import { TabNavProvider } from "@/components/navigation/tab-nav-provider";
import { LastPlayedGameTracker } from "@/components/games/last-played-tracker";
import { ActivityDateSync } from "@/components/activity-date-sync";
import { ViewAsBanner } from "@/components/view-as-banner";
import { FirstRunProvider } from "@/components/first-run/first-run-provider";
import { PointsToastProvider } from "@/components/points/points-toast-provider";
import {
  getCachedAuthSession,
  getCachedCourseAccess,
  getCachedOnboardingProfile,
} from "@/lib/supabase/cached-session";
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
  const [access, onboarding, kidSession, soundSettings] = await Promise.all([
    getCachedCourseAccess(supabase, user),
    getCachedOnboardingProfile(supabase, user.id),
    loadKidSession(user.id),
    loadSoundSettings(supabase, user.id),
  ]);

  const kid = kidSession.activeKidProfile;
  const showKidsExit =
    kid && !usesKidsShell(kid.age_tier) && !access.viewAs?.active;

  return (
    <FirstRunProvider
      hasSeenIntroPitch={onboarding.hasSeenIntroPitch}
      hasSeenOnboarding={onboarding.hasSeenOnboarding}
    >
      <KidSessionProvider activeKidProfile={kid} hasPin={kidSession.hasPin}>
        <AudioManagerProvider initialSettings={soundSettings}>
        <PointsToastProvider />
        <TabNavProvider>
          <div className={`flex min-h-dvh flex-1 flex-col ${ui.pageBg}`}>
            <ActivityDateSync />
            <LastPlayedGameTracker />
            {access.viewAs?.active && <ViewAsBanner label={access.viewAs.label} />}
            {showKidsExit && <KidsExitButton />}
            <div
              className={`mx-auto flex w-full max-w-lg flex-1 flex-col ${ui.pageBg} ${ui.navClearance} relative isolate`}
            >
              {children}
            </div>
            <BottomNav />
          </div>
        </TabNavProvider>
        </AudioManagerProvider>
      </KidSessionProvider>
    </FirstRunProvider>
  );
}
