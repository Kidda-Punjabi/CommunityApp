import { CommunityPageHeader } from "@/components/community/community-page-header";
import { loadCommunityHome, memberHasCommunity } from "@/lib/community/load-home";
import { currentStreak, type StreakOccurrence } from "@/lib/community/streak";
import { TROPHIES } from "@/lib/community/trophies";
import { requireNoKidCommunityAccess } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";

function progressLine(key: string, value: number, goal: number): string {
  if (key.startsWith("streak_")) return `${value} of ${goal} weeks`;
  if (key.includes("win")) return `${value} of ${goal} wins`;
  return `${value} of ${goal}`;
}

export default async function CommunityTrophiesPage() {
  const { user } = await requireNoKidCommunityAccess();
  const admin = createServiceRoleClient();
  if (!(await memberHasCommunity(admin, user.id))) return null;
  const home = await loadCommunityHome(admin, user.id);
  const { data: checkins } = await admin
    .from("community_checkins")
    .select("is_late, occurrence_id, community_session_occurrences(session_id, starts_at, ends_at)")
    .eq("user_id", user.id);
  const rows = checkins ?? [];
  const mainRows = rows.filter((row) => {
    const occurrence = Array.isArray(row.community_session_occurrences) ? row.community_session_occurrences[0] : row.community_session_occurrences;
    return occurrence?.session_id === home.mainSessionId;
  });
  const bonusCount = rows.length - mainRows.length;
  const onTime = rows.filter((row) => !row.is_late).length;
  const streakRows: StreakOccurrence[] = mainRows.map((row) => {
    const occurrence = Array.isArray(row.community_session_occurrences) ? row.community_session_occurrences[0] : row.community_session_occurrences;
    return { startsAt: occurrence?.starts_at ?? "", endsAt: occurrence?.ends_at ?? "", attended: true };
  });
  const streak = currentStreak(streakRows, home.firstStartsOn, new Date());
  const progress: Record<string, number> = {
    first_checkin: Math.min(1, rows.length),
    streak_4: streak,
    streak_8: streak,
    streak_12: streak,
    streak_24: streak,
    perfect_month: 0,
    early_bird: onTime,
    bonus_explorer: bonusCount,
    first_room_win: 0,
    room_wins_5: 0,
    room_wins_25: 0,
    speak_it_champion: 0,
    full_deck: 0,
  };
  const unlocked = TROPHIES.filter((trophy) => (progress[trophy.key] ?? 0) >= trophy.goal);
  const { data: moves } = await admin
    .from("kidda_level_history")
    .select("from_level, to_level, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className={`${ui.page} font-[family-name:var(--font-community)]`}>
      <CommunityPageHeader title="Trophies" />
      <section id="wins" className="mt-3 rounded-[20px] bg-white p-3">
        <h2 className="font-heading text-sm font-extrabold text-[#1F1640]">Wins</h2>
        <p className="mt-1 text-xs text-[#4A3F66]">Level moves and streak milestones from the Community will show up here.</p>
        <ul className="mt-2 space-y-1">
          {(moves ?? []).filter((move) => move.from_level == null || move.to_level !== move.from_level).map((move) => (
            <li key={move.created_at as string} className="text-xs font-semibold text-[#1F1640]">
              {move.from_level == null ? `Placed at Level ${move.to_level}` : `Level ${move.from_level} to Level ${move.to_level}`}
            </li>
          ))}
          {streak >= 4 ? <li className="text-xs font-semibold text-[#1F1640]">{streak}-week streak</li> : null}
        </ul>
      </section>
      <p className="mt-2 text-sm font-semibold text-[#4A3F66]">{unlocked.length} of {TROPHIES.length} unlocked</p>
      <ul className="mt-4 grid grid-cols-2 gap-2">
        {TROPHIES.map((trophy) => {
          const value = Math.min(trophy.goal, progress[trophy.key] ?? 0);
          const open = value >= trophy.goal;
          return (
            <li key={trophy.key} className={`rounded-[20px] p-3 ${open ? "bg-[#F1ECFF]" : "bg-white text-[#6B5F8A]"}`}>
              <p className={`font-heading text-sm font-extrabold ${open ? "text-[#5B21B6]" : ""}`}>{trophy.name}</p>
              <p className="mt-1 text-xs">{trophy.takes}</p>
              <p className="mt-2 text-xs font-bold">{open ? "Unlocked" : progressLine(trophy.key, value, trophy.goal)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
