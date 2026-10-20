import { SessionCheckInButtons } from "@/components/community/check-in-ui";
import { AppTile } from "@/components/ui/app-tile";
import { canJoinSession, daysUntilLabel, formatSessionClock } from "@/lib/community/format";
import type { CommunityHome } from "@/lib/community/load-home";
import { bandFillVar, bandForLevel, bandInkVar, bandLabel, levelFillVar, levelInkVar } from "@/lib/community/levels";
import { freshLabel } from "@/lib/forum/unread";
import { CalendarPlus, Flame, Folder, MessageCircle, Play, Trophy, Users } from "lucide-react";
import Link from "next/link";

export type CommunityLeaderboardPreview = {
  top: { userId: string; name: string; points: number; rank: number }[];
  youRank: number | null;
  youPoints: number;
};

function ordinal(rank: number): string {
  const mod100 = rank % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${rank}th`;
  const mod10 = rank % 10;
  if (mod10 === 1) return `${rank}st`;
  if (mod10 === 2) return `${rank}nd`;
  if (mod10 === 3) return `${rank}rd`;
  return `${rank}th`;
}

const MEDALS = ["🥇", "🥈", "🥉"];

const TILES = [
  { href: "/dashboard/community/forum", label: "Forum", icon: MessageCircle, forum: true },
  { href: "/dashboard/community/pod", label: "Your pod", icon: Users, forum: false },
  { href: "/dashboard/community/practice", label: "Practice", icon: Play, forum: false },
  { href: "/dashboard/community/topics", label: "Topics", icon: Folder, forum: false },
  { href: "/dashboard/community/bonus", label: "Bonus sessions", icon: CalendarPlus, forum: false },
  { href: "/dashboard/community/trophies", label: "Trophies & wins", icon: Trophy, forum: false },
] as const;

export function CommunityTab({
  home,
  earned,
  target,
  percent,
  fresh = 0,
  replies = 0,
  anyLive = false,
  checkedIntoNext = false,
  checkReady = false,
  cooldownUntil = null,
  leaderboard,
}: {
  home: CommunityHome;
  earned: number;
  target: number | null;
  percent: number;
  fresh?: number;
  replies?: number;
  anyLive?: boolean;
  checkedIntoNext?: boolean;
  checkReady?: boolean;
  cooldownUntil?: string | null;
  leaderboard: CommunityLeaderboardPreview;
}) {
  const next = home.next;
  const live = next?.status === "live";
  const joinReady = next ? canJoinSession(next.startsAt, next.endsAt) : false;
  const streakCopy = !home.sessionsStarted
    ? home.startsLabel ?? "Your first session is coming up"
    : home.streak > 0
      ? `${home.streak} week${home.streak === 1 ? "" : "s"}`
      : `Start a new streak on ${home.weekdayLabel ?? "your session day"}`;

  return (
    <div className="flex flex-col gap-2 font-[family-name:var(--font-community)] text-[#1F1640]">
      <section className="rounded-[24px] bg-[#5B21B6] p-3 text-white">
        <p className="text-sm text-violet-100">{live ? "Live now" : "Next session"}</p>
        <h2 className="mt-1 font-heading text-2xl font-extrabold">
          {next ? formatSessionClock(next.startsAt, home.timezone) : "Your session"}
        </h2>
        <p className="mt-1 text-sm text-violet-100">
          {next
            ? `Week ${next.weekNumber}${next.topic ? ` · ${next.topic}` : ""} · ${daysUntilLabel(next.startsAt, home.timezone)}`
            : "We'll show the time here as soon as it's on the calendar."}
        </p>
        <Link
          href="/dashboard/community/streak"
          className="mt-3 inline-flex max-w-full flex-col items-start gap-1.5"
        >
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#5B21B6]">
            <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{streakCopy}</span>
          </span>
          {home.sessionsStarted && home.dots.length > 0 ? (
            <span className="flex gap-1.5 px-1">
              {home.dots.map((dot, index) => (
                <span
                  key={index}
                  className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white"
                  style={{ background: dot.filled ? "#ffffff" : "transparent" }}
                />
              ))}
            </span>
          ) : null}
        </Link>
        <div className="mt-3 flex flex-wrap gap-2">
          <SessionCheckInButtons
            meetUrl={next?.meetUrl ?? null}
            canJoin={Boolean(next?.meetUrl && (live || joinReady))}
            anyLive={anyLive}
            returnToCheckIn={Boolean(live && next && !checkedIntoNext)}
          />
        </div>
      </section>

      <div className="grid grid-cols-2 content-start gap-2">
        <div className="rounded-[20px] bg-white p-3">
          <Link href="/dashboard/community/level">
            <p className="text-xs text-[#6B5F8A]">Level</p>
            <p className="mt-1 font-heading text-lg font-extrabold" style={{ color: home.level == null ? undefined : levelInkVar(home.level) }}>
              {home.level == null ? "Not set" : `Level ${home.level}`}
            </p>
          </Link>
          {home.level != null ? (
            <>
              <span className="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: bandFillVar(bandForLevel(home.level)), color: bandInkVar(bandForLevel(home.level)) }}>
                {bandLabel(bandForLevel(home.level))}
              </span>
              <span className="mt-2 block h-1.5 rounded-full bg-[#F7F5FC]">
                <span className="block h-1.5 rounded-full" style={{ width: `${percent}%`, background: levelFillVar(home.level) }} />
              </span>
              {cooldownUntil ? (
                <span className="mt-1 block text-[11px] font-semibold text-[#6B5F8A]">
                  Try again on {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: home.timezone }).format(new Date(cooldownUntil))}
                </span>
              ) : checkReady && target != null ? (
                <>
                  <span className="mt-1 block text-[11px] font-semibold text-[#6B5F8A]">
                    Your Level {home.level + 1} check is ready
                  </span>
                  <Link
                    href="/dashboard/community/level/retake"
                    className="mt-2 inline-flex h-9 items-center rounded-full bg-[#FDE68A] px-3 text-xs font-bold text-[#3B1A8C]"
                  >
                    Take the check
                  </Link>
                </>
              ) : (
                <span className="mt-1 block text-[11px] font-semibold text-[#6B5F8A]">
                  {target == null ? "Top level" : `${earned} of ${target} XP to your Level ${home.level + 1} check`}
                </span>
              )}
            </>
          ) : null}
        </div>
        <Link href="/dashboard/leaderboard" className="rounded-[20px] bg-white p-3">
          <p className="text-xs text-[#6B5F8A]">Leaderboard · This week</p>
          {leaderboard.top.length > 0 ? (
            <ol className="mt-2 space-y-1">
              {leaderboard.top.map((person) => (
                <li key={person.userId} className="flex items-center gap-1.5 text-xs">
                  <span className="w-4 shrink-0 text-center" aria-hidden="true">
                    {MEDALS[person.rank - 1] ?? person.rank}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{person.name}</span>
                  <span className="shrink-0 tabular-nums text-[#6B5F8A]">{person.points}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-xs font-semibold text-[#6B5F8A]">No points yet this week</p>
          )}
          <p className="mt-2 text-[11px] font-semibold text-[#1F1640]">
            {leaderboard.youRank == null
              ? `You: ${leaderboard.youPoints} pts`
              : `You: ${ordinal(leaderboard.youRank)} · ${leaderboard.youPoints} pts`}
          </p>
        </Link>
      </div>

      <div className="grid grid-cols-2 content-start gap-2">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const badge = tile.forum ? freshLabel(fresh) : null;
          return (
            <AppTile
              key={tile.href}
              href={tile.href}
              title={tile.label}
              subtitle={tile.forum && replies > 0 ? `${replies} ${replies === 1 ? "reply" : "replies"} to you` : undefined}
              icon={<Icon className="h-4 w-4" />}
              badge={badge}
              stacked
            />
          );
        })}
      </div>
    </div>
  );
}
