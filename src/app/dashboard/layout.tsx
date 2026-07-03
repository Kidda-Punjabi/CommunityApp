import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BottomNav } from "@/components/bottom-nav";
import { LastPlayedGameTracker } from "@/components/games/last-played-tracker";
import { ActivityDateSync } from "@/components/activity-date-sync";
import { ViewAsBanner } from "@/components/view-as-banner";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { PointsToastProvider } from "@/components/points/points-toast-provider";
import { loadOnboardingProfile } from "@/lib/progression/load-user-progression";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { ui } from "@/lib/ui/styles";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const access = await getCourseAccessContext(supabase, user);
  const onboarding = await loadOnboardingProfile(supabase, user.id);

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
