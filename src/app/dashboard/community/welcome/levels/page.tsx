import { OnboardingButton, OnboardingFrame } from "@/components/community/onboarding-shell";
import { bandFillVar, bandInkVar, levelFillVar, levelInkVar } from "@/lib/community/levels";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { redirect } from "next/navigation";

const BANDS = [
  { id: "sounds" as const, name: "Sounds", range: "Level 0", levels: [0], text: "The sounds of Punjabi, including the ones English doesn't have." },
  { id: "beginner" as const, name: "Beginner", range: "Levels 1 to 3", levels: [1, 2, 3], text: "Greetings, daily life, and talking about yesterday and tomorrow." },
  { id: "intermediate" as const, name: "Intermediate", range: "Levels 4 to 6", levels: [4, 5, 6], text: "Opinions, what if, and a conversation that lasts a few minutes." },
  { id: "advanced" as const, name: "Advanced", range: "Levels 7 to 9", levels: [7, 8, 9], text: "Fast natural speech, idioms, and deeper topics." },
];

export default async function WelcomeLevelsPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) redirect("/dashboard/community");
  const home = await loadCommunityHome(admin, user.id);
  if (!home.mainSessionId) redirect("/dashboard/community/welcome");
  if (home.level != null) redirect("/dashboard/community");

  return (
    <OnboardingFrame
      step="2 of 3"
      backHref="/dashboard/community/welcome/why"
      action={<OnboardingButton href="/dashboard/community/placement">I&apos;m ready, start</OnboardingButton>}
    >
      <div>
        <h1 className="font-heading text-2xl font-extrabold">Ten levels, one path</h1>
        <ul className="mt-3 space-y-2">
          {BANDS.map((band) => (
            <li key={band.id} className="flex items-center gap-3 rounded-[20px] bg-white p-3">
              <div className="grid w-[4.5rem] grid-cols-3 gap-1">
                {band.levels.length === 1 ? <span className="col-start-2 flex h-6 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: levelFillVar(0), color: levelInkVar(0) }}>0</span> : band.levels.map((level) => (
                  <span key={level} className="flex h-6 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: levelFillVar(level), color: levelInkVar(level) }}>{level}</span>
                ))}
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: bandInkVar(band.id) }}>{band.name} · {band.range}</p>
                <p className="text-xs text-[#4A3F66]">{band.text}</p>
              </div>
              <span className="sr-only" style={{ background: bandFillVar(band.id) }} />
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="rounded-[18px] bg-white px-3 py-2 text-center text-xs font-semibold text-[#4A3F66]">2 minutes · Listen and pick an answer · No Gurmukhi needed</p>
        <p className="mt-2 text-center text-xs text-[#6B5F8A]">Headphones help, but aren&apos;t essential</p>
      </div>
    </OnboardingFrame>
  );
}
