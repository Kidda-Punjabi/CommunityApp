import { OnboardingButton, OnboardingFrame } from "@/components/community/onboarding-shell";
import { WelcomeIntro } from "@/components/community/welcome-intro";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { redirect } from "next/navigation";

export default async function CommunityWelcomePage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  const home = await loadCommunityHome(admin, user.id);
  if (home.mainSessionId && home.level != null) redirect("/dashboard/community");
  if (home.mainSessionId) redirect("/dashboard/community/welcome/why");

  return (
    <OnboardingFrame action={<OnboardingButton href="/dashboard/community/welcome/session">Get started</OnboardingButton>}>
      <WelcomeIntro />
    </OnboardingFrame>
  );
}
