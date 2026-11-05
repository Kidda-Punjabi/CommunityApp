import { SessionCheckInButtons } from "@/components/community/check-in-ui";
import { CommunityLiveSync } from "@/components/community/room-refresh";
import { daysUntilLabel, formatCheckInOpensAt, formatNextSessionWhen } from "@/lib/community/format";
import type { CommunityHome } from "@/lib/community/load-home";
import type { ForumPostPreview } from "@/lib/forum/types";
import { freshLabel } from "@/lib/forum/unread";
import { CalendarPlus, Flame, Folder, Play, Trophy, Users } from "lucide-react";
import Link from "next/link";

function timeAgo(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const SHORTCUTS = [
  { href: "/dashboard/community/pod", label: "Your pod", icon: Users },
  { href: "/dashboard/community/practice", label: "Practice", icon: Play },
  { href: "/dashboard/community/topics", label: "Topics", icon: Folder },
  { href: "/dashboard/community/bonus", label: "Bonus sessions", icon: CalendarPlus },
  { href: "/dashboard/community/trophies", label: "Trophies & wins", icon: Trophy },
] as const;

export function CommunityTab({
  home,
  posts = [],
  earned,
  target,
  percent,
  fresh = 0,
  replies = 0,
  anyLive = false,
  checkedIntoNext = false,
  openCheckIn = false,
  liveIds = [],
  checkReady = false,
  cooldownUntil = null,
}: {
  home: CommunityHome;
  posts?: ForumPostPreview[];
  earned: number;
  target: number | null;
  percent: number;
  fresh?: number;
  replies?: number;
  anyLive?: boolean;
  checkedIntoNext?: boolean;
  openCheckIn?: boolean;
  liveIds?: string[];
  checkReady?: boolean;
  cooldownUntil?: string | null;
}) {
  const next = home.next;
  const live = Boolean(anyLive || next?.status === "live");
  const streakCopy = !home.sessionsStarted
    ? home.startsLabel ?? "Your first session is coming up"
    : home.streak > 0
      ? `${home.streak} week streak`
      : `New streak on ${home.weekdayLabel ?? "your session day"}`;
  const freshBadge = freshLabel(fresh);
  const levelLine =
    home.level == null
      ? "Level not set"
      : cooldownUntil
        ? `Level ${home.level} · Try again ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: home.timezone }).format(new Date(cooldownUntil))}`
        : target == null
          ? `Level ${home.level} · Top level`
          : `Level ${home.level} · ${earned}/${target} XP · ${percent}%`;

  return (
    <div className="-mx-5 flex min-h-0 flex-1 flex-col font-[family-name:var(--font-community)] text-[#1F1640]">
      <CommunityLiveSync
        channelId={next?.id ?? "community-tab"}
        occurrenceId={next?.id ?? null}
        occurrenceIds={liveIds}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="rounded-b-[28px] bg-[#5B21B6] px-4 pb-4 pt-3 text-white">
          <h1 className="font-heading text-[26px] font-extrabold leading-tight tracking-tight">Community</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {checkReady && target != null && home.level != null && !cooldownUntil ? (
              <Link href="/dashboard/community/level/retake" className="inline-flex min-h-8 items-center rounded-full bg-[#FDE68A] px-3 text-xs font-bold text-[#3B1A8C]">
                Take your Level {home.level + 1} check
              </Link>
            ) : (
              <Link href="/dashboard/community/level" className="inline-flex min-h-8 items-center rounded-full bg-white/15 px-3 text-xs font-bold">{levelLine}</Link>
            )}
            <Link href="/dashboard/community/streak" className="inline-flex min-h-8 items-center gap-1 rounded-full bg-white/15 px-3 text-xs font-bold">
              <Flame className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {streakCopy}
            </Link>
          </div>
        </section>

        <div className="flex flex-col gap-3 px-4 pt-3">
          <section className="rounded-[20px] border border-[#ECE9F5] bg-white px-3.5 pb-1 pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-heading text-base font-extrabold">
                Forum
                {freshBadge ? <span className="ml-2 rounded-full bg-[#5B21B6] px-2 py-0.5 text-[11px] font-bold text-white">{freshBadge}</span> : null}
              </h2>
              <Link href="/dashboard/community/forum" className="text-[13px] font-bold text-[#5B21B6]">
                {replies > 0 ? `${replies} ${replies === 1 ? "reply" : "replies"} to you ›` : "See all ›"}
              </Link>
            </div>
            {posts.length > 0 ? (
              <ul className="divide-y divide-[#F1EFF7]">
                {posts.map((post) => (
                  <li key={post.id}>
                    <Link href={`/dashboard/community/forum/${post.id}`} className="flex min-h-[52px] items-center gap-2.5 py-1.5">
                      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[#F1EBFF] text-sm font-extrabold text-[#5B21B6]">
                        {post.author.displayName.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-extrabold">
                          {post.author.displayName} <span className="font-medium text-[#6B5F8A]">· {timeAgo(post.createdAt)}</span>
                        </span>
                        <span className="block truncate text-sm font-medium">{post.title}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-sm font-medium text-[#6B5F8A]">No posts yet. Start the first conversation.</p>
            )}
          </section>

          <nav aria-label="More in Community" className="grid grid-cols-5 gap-1 pb-3">
            {SHORTCUTS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="flex flex-col items-center gap-1 text-center text-[11px] font-bold leading-tight">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#F1EBFF] text-[#5B21B6]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#F1EFF7] px-4 pb-3 pt-2">
        <p className="mb-1.5 truncate text-center text-[13px] font-bold text-[#4B4366]">
          {next
            ? `Next session · ${formatNextSessionWhen(next.startsAt, home.timezone)}${next.topic ? ` · ${next.topic}` : ""}`
            : "We'll show the next session as soon as it's on the calendar."}
        </p>
        {live ? (
          checkedIntoNext ? (
            <p className="flex h-14 items-center justify-center rounded-[20px] bg-[#DFF6EC] text-base font-extrabold text-[#075E47]">You&apos;re checked in</p>
          ) : (
            <SessionCheckInButtons meetUrl={next?.meetUrl ?? null} live openOnMount={openCheckIn} />
          )
        ) : next ? (
          <button type="button" disabled className="flex h-[72px] w-full flex-col items-center justify-center rounded-[20px] bg-[#EFEAFD] text-[#4B2A9E]">
            <span className="text-[22px] font-extrabold leading-tight">Check in</span>
            <span className="text-xs font-bold">Opens {formatCheckInOpensAt(next.startsAt, home.timezone)} · {daysUntilLabel(next.startsAt, home.timezone)}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
