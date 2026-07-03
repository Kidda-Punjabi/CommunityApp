import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { LastPlayedGameTracker } from "@/components/games/last-played-tracker";
import { ActivityDateSync } from "@/components/activity-date-sync";
import { ViewAsBanner } from "@/components/view-as-banner";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { PointsToastProvider } from "@/components/points/points-toast-provider";
import {
  getCachedAuthSession,
  getCachedCourseAccess,
  getCachedOnboardingProfile,
} from "@/lib/supabase/cached-session";
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
  const [access, onboarding] = await Promise.all([
    getCachedCourseAccess(supabase, user),
    getCachedOnboardingProfile(supabase, user.id),
  ]);

  return (
    <OnboardingProvider showOnFirstVisit={!onboarding.hasSeenOnboarding}>
      <PointsToastProvider />
      <div className={`flex min-h-dvh flex-1 flex-col ${ui.pageBg}`}>
        <ActivityDateSync />
        <LastPlayedGameTracker />
        {access.viewAs?.active && <ViewAsBanner label={access.viewAs.label} />}
        <div
          className={`mx-auto flex w-full max-w-lg flex-1 flex-col ${ui.pageBg} ${ui.navClearance}`}
        >
          {children}
        </div>
        <BottomNav />
      </div>
    </OnboardingProvider>
  );
}
