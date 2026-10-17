import { OnboardingButton, OnboardingFrame } from "@/components/community/onboarding-shell";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { redirect } from "next/navigation";

const GIFTS = [
  "A weekly live session with Arsh",
  "Your own pod",
  "Games and breakout rooms",
  "Streaks and trophies",
];

export default async function CommunityWelcomePage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  const home = await loadCommunityHome(admin, user.id);
  if (home.mainSessionId && home.level != null) redirect("/dashboard/community");
  if (home.mainSessionId) redirect("/dashboard/community/welcome/why");

  return (
    <OnboardingFrame action={<OnboardingButton href="/dashboard/community/welcome/session">Get started</OnboardingButton>}>
      <div className="flex flex-1 flex-col justify-center">
        <img src="/logo/kidda-peacock.png" alt="" className="h-16 w-16" />
        <p className="mt-4 font-heading text-3xl font-extrabold">Ji aayan nu!</p>
        <h1 className="mt-1 font-heading text-2xl font-extrabold">Welcome to the Kidda Community</h1>
        <ul className="mt-5 space-y-2">
          {GIFTS.map((gift) => (
            <li key={gift} className="rounded-[20px] bg-white px-4 py-3 text-sm font-semibold">{gift}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-[#4A3F66]">Two quick questions and you&apos;re in. About 3 minutes.</p>
      </div>
    </OnboardingFrame>
  );
}
