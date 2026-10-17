import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

export default async function CommunityStreakPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const home = await loadCommunityHome(admin, user.id);
  const copy = !home.sessionsStarted
    ? home.startsLabel ?? "Your first session is coming up."
    : home.streak > 0
      ? `${home.streak} week${home.streak === 1 ? "" : "s"} in a row.`
      : `Start a new streak on ${home.weekdayLabel ?? "your session day"}.`;
  return (
    <div className={ui.page}>
      <Link href="/dashboard/community" className="text-sm font-semibold text-violet-700">Community</Link>
      <h1 className="mt-2 font-heading text-2xl font-bold">Streak</h1>
      <p className="mt-3 text-sm text-zinc-700">{copy}</p>
      <p className="mt-2 text-sm text-zinc-500">Filled dots are main sessions you checked in for. Bonus sessions don't change this streak.</p>
      {home.sessionsStarted ? (
        <div className="mt-6 flex gap-3 px-1">
          {home.dots.map((dot, index) => (
            <span key={index} className="inline-block h-3.5 w-3.5 rounded-full border-2 border-violet-600" style={{ background: dot.filled ? "#7c3aed" : "transparent" }} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
