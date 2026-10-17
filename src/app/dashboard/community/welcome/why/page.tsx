import { OnboardingButton, OnboardingFrame } from "@/components/community/onboarding-shell";
import { levelFillVar, levelInkVar } from "@/lib/community/levels";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const REASONS = [
  "Your pod is people at a similar level",
  "Games and topics match where you are",
  "Arsh can support you properly",
];

export default async function WelcomeWhyPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  const home = await loadCommunityHome(admin, user.id);
  const pending = (await cookies()).get("community_pending_session")?.value;
  if (!home.mainSessionId && !pending) redirect("/dashboard/community/welcome/session");
  if (home.level != null) redirect("/dashboard/community");

  return (
    <OnboardingFrame
      step="2 of 3"
      backHref="/dashboard/community/welcome/session"
      action={<OnboardingButton href="/dashboard/community/welcome/levels" tone="gold">See the levels</OnboardingButton>}
    >
      <div className="flex flex-col justify-start rounded-[24px] bg-[#5B21B6] p-5 text-white">
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 10 }, (_, level) => (
            <span key={level} className="flex h-8 items-center justify-center rounded-full text-xs font-bold" style={{ background: levelFillVar(level), color: levelInkVar(level) }}>{level}</span>
          ))}
        </div>
        <h1 className="mt-4 font-heading text-3xl font-extrabold">Let&apos;s find your level</h1>
        <ul className="mt-4 space-y-2">
          {REASONS.map((reason) => (
            <li key={reason} className="rounded-[18px] bg-white/10 px-3 py-2 text-sm font-semibold">{reason}</li>
          ))}
        </ul>
        <div className="mt-4 rounded-[20px] bg-white p-4 text-[#1F1640]">
          <p className="font-heading font-extrabold">No pressure, honestly.</p>
          <p className="mt-1 text-sm text-[#4A3F66]">It&apos;s not a test you pass or fail, and it&apos;s not about getting everything right. It just shows us where you are, so we can support you properly.</p>
        </div>
      </div>
    </OnboardingFrame>
  );
}
