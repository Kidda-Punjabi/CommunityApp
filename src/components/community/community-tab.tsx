import { canJoinSession, daysUntilLabel, formatSessionClock } from "@/lib/community/format";
import type { CommunityHome } from "@/lib/community/load-home";
import { bandFillVar, bandForLevel, bandInkVar, bandLabel, levelFillVar, levelInkVar } from "@/lib/community/levels";
import Link from "next/link";

const TILES = [
  { href: "/dashboard/community/pod", label: "Your pod", icon: "👥" },
  { href: "/dashboard/community/practice", label: "Practice", icon: "▶" },
  { href: "/dashboard/community/topics", label: "Topics", icon: "🗂" },
  { href: "/dashboard/community/wins", label: "Wins", icon: "★" },
  { href: "/dashboard/community/bonus", label: "Bonus sessions", icon: "+" },
  { href: "/dashboard/community/trophies", label: "Trophies", icon: "🏆" },
] as const;

function LevelFace({ name, level }: { name: string; level: number | null }) {
  return (
    <span
      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#1F1640]"
      style={level == null ? undefined : { boxShadow: `0 0 0 3px ${levelFillVar(level)}` }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function CommunityTab({ home }: { home: CommunityHome }) {
  const next = home.next;
  const live = next?.status === "live";
  const joinReady = next ? canJoinSession(next.startsAt, next.endsAt) : false;
  const streakCopy = !home.sessionsStarted
    ? home.startsLabel ?? "Your first session is coming up"
    : home.streak > 0
      ? `${home.streak} week${home.streak === 1 ? "" : "s"}`
      : `Start a new streak on ${home.weekdayLabel ?? "your session day"}`;

  return (
    <div className="space-y-3 font-[family-name:var(--font-community)] text-[#1F1640]">
      <section className="rounded-[24px] bg-[#5B21B6] p-4 text-white">
        <p className="text-sm text-violet-100">{live ? "Live now" : "Next session"}</p>
        <h2 className="mt-1 font-heading text-2xl font-extrabold">
          {next ? formatSessionClock(next.startsAt, home.timezone) : "Your session"}
        </h2>
        <p className="mt-1 text-sm text-violet-100">
          {next
            ? `Week ${next.weekNumber}${next.topic ? ` · ${next.topic}` : ""} · ${daysUntilLabel(next.startsAt, home.timezone)}`
            : "We'll show the time here as soon as it's on the calendar."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {next?.meetUrl && (live || joinReady) ? (
            <a href={next.meetUrl} target="_blank" rel="noreferrer" className="inline-flex h-14 items-center rounded-[18px] bg-[#FDE68A] px-4 text-sm font-bold text-[#3B1A8C]">
              Join
            </a>
          ) : (
            <span className="inline-flex h-14 items-center rounded-[18px] bg-white/20 px-4 text-sm font-bold">Join</span>
          )}
          {live && next ? (
            <Link href={`/dashboard/community/check-in?occurrence=${next.id}`} className="inline-flex h-14 items-center rounded-[18px] bg-white px-4 text-sm font-bold text-[#5B21B6]">
              Check in
            </Link>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/community/level" className="rounded-[20px] bg-white p-4">
          <p className="text-xs text-[#6B5F8A]">Level</p>
          <p className="mt-1 font-heading text-lg font-extrabold" style={{ color: home.level == null ? undefined : levelInkVar(home.level) }}>
            {home.level == null ? "Not set" : `Level ${home.level}`}
          </p>
          {home.level != null ? (
            <>
              <span className="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: bandFillVar(bandForLevel(home.level)), color: bandInkVar(bandForLevel(home.level)) }}>
                {bandLabel(bandForLevel(home.level))}
              </span>
              <span className="mt-2 block h-1.5 rounded-full bg-[#F7F5FC]">
                <span className="block h-1.5 rounded-full" style={{ width: `${(home.level / 9) * 100}%`, background: levelFillVar(home.level) }} />
              </span>
            </>
          ) : null}
        </Link>
        <Link href="/dashboard/community/streak" className="rounded-[20px] bg-white p-4">
          <p className="text-xs text-[#6B5F8A]">Streak</p>
          <p className="mt-1 font-heading text-lg font-extrabold">{streakCopy}</p>
          {home.sessionsStarted && home.dots.length > 0 ? (
            <span className="mt-3 flex gap-2">
              {home.dots.map((dot, index) => (
                <span key={index} className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[#7C3AED]" style={{ background: dot.filled ? "#7C3AED" : "transparent" }} />
              ))}
            </span>
          ) : null}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-[20px] bg-white px-2 py-3 text-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F1ECFF] text-sm">{tile.icon}</span>
            <span className="text-xs font-bold">{tile.label}</span>
          </Link>
        ))}
      </div>

      {home.podmates.length > 0 ? (
        <div className="flex gap-2 px-1">
          {home.podmates.slice(0, 8).map((mate) => (
            <LevelFace key={mate.userId} name={mate.name} level={mate.level} />
          ))}
        </div>
      ) : null}

      <Link href="/dashboard/community/forum" className="block px-1 text-sm font-bold text-[#7C3AED]">
        Community forum
      </Link>
    </div>
  );
}
