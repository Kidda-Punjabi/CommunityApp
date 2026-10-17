import { pickMainSession, placeInPod } from "@/app/dashboard/community/actions";
import { canJoinSession, daysUntilLabel, formatSessionClock, googleCalendarUrl } from "@/lib/community/format";
import type { CommunityHome } from "@/lib/community/load-home";
import { bandFillVar, bandForLevel, bandInkVar, bandLabel, levelFillVar, levelInkVar } from "@/lib/community/levels";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

const TILES = [
  { href: "/dashboard/community/pod", label: "Your pod" },
  { href: "/dashboard/community/practice", label: "Practice" },
  { href: "/dashboard/community/topics", label: "Topics" },
  { href: "/dashboard/community/wins", label: "Wins" },
  { href: "/dashboard/community/bonus", label: "Bonus sessions" },
  { href: "/dashboard/community/trophies", label: "Trophies" },
] as const;

function LevelFace({ name, level }: { name: string; level: number | null }) {
  return (
    <span
      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-semibold text-zinc-800"
      style={level == null ? undefined : { boxShadow: `0 0 0 3px ${levelFillVar(level)}` }}
      title={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function CommunityTab({ home }: { home: CommunityHome }) {
  if (home.step === "session") {
    return (
      <section className={ui.card}>
        <h2 className="font-heading text-xl font-semibold text-zinc-900">Pick your main weekly session</h2>
        <p className="mt-1 text-sm text-zinc-600">One session is yours. The others stay open as bonus sessions.</p>
        <div className="mt-4 space-y-2">
          {home.slots.map((slot) => (
            <form key={slot.id} action={async (formData) => {
              "use server";
              await pickMainSession(formData);
            }}>
              <input type="hidden" name="sessionId" value={slot.id} />
              <button type="submit" className={`${ui.btnSecondary} min-h-11 w-full gap-3`}>
                <span>{slot.localWhen}</span>
                <span className="text-zinc-500">{slot.startsLabel ?? slot.title}</span>
              </button>
            </form>
          ))}
        </div>
      </section>
    );
  }

  if (home.step === "test") {
    return (
      <section className={ui.card}>
        <h2 className="font-heading text-xl font-semibold text-zinc-900">Find your level</h2>
        <p className="mt-1 text-sm text-zinc-600">A 2-minute speaking check. It places you with people at a similar level.</p>
        <Link href="/dashboard/community/placement" className={`${ui.btnPrimary} mt-4 min-h-11`}>
          Start the test
        </Link>
      </section>
    );
  }

  if (home.step === "pod") {
    return (
      <section className={ui.card}>
        <h2 className="font-heading text-xl font-semibold text-zinc-900">Your pod</h2>
        <p className="mt-1 text-sm text-zinc-600">We'll put you with a small group in your session.</p>
        <form action={async () => {
          "use server";
          await placeInPod();
        }} className="mt-4">
          <button type="submit" className={`${ui.btnPrimary} min-h-11`}>
            See your pod
          </button>
        </form>
      </section>
    );
  }

  const next = home.next;
  const live = next?.status === "live";
  const joinReady = next ? canJoinSession(next.startsAt, next.endsAt) : false;
  const streakCopy = !home.sessionsStarted
    ? home.startsLabel ?? "Your first session is coming up"
    : home.streak > 0
      ? `${home.streak} week${home.streak === 1 ? "" : "s"}`
      : `Start a new streak on ${home.weekdayLabel ?? "your session day"}`;

  return (
    <div className="space-y-3">
      <section className="rounded-3xl bg-violet-600 p-4 text-white">
        <p className="text-sm text-violet-100">{live ? "Live now" : "Next session"}</p>
        <h2 className="mt-1 font-heading text-2xl font-bold">
          {next ? formatSessionClock(next.startsAt, home.timezone) : "Your session"}
        </h2>
        <p className="mt-1 text-sm text-violet-100">
          {next
            ? `Week ${next.weekNumber}${next.topic ? ` · ${next.topic}` : ""} · ${daysUntilLabel(next.startsAt, home.timezone)}`
            : "We'll show the time here as soon as it's on the calendar."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {next?.meetUrl && (live || joinReady) ? (
            <a href={next.meetUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-violet-700">
              Join
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center rounded-full bg-white/20 px-4 text-sm font-semibold">Join</span>
          )}
          {live && next ? (
            <Link href={`/dashboard/community/check-in?occurrence=${next.id}`} className="inline-flex min-h-11 items-center rounded-full bg-white px-4 text-sm font-semibold text-violet-700">
              Check in
            </Link>
          ) : null}
          {next ? (
            <a href={googleCalendarUrl(`${next.sessionTitle} · ${next.topic ?? "Kidda Community"}`, next.startsAt, next.endsAt)} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-white">
              Add to calendar
            </a>
          ) : null}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/community/level" className={ui.statCard}>
          <p className="text-xs text-zinc-500">Level</p>
          <p className="mt-1 font-heading text-lg font-semibold" style={{ color: home.level == null ? undefined : levelInkVar(home.level) }}>
            {home.level == null ? "Not set" : `Level ${home.level}`}
          </p>
          {home.level != null ? (
            <>
              <span className="mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: bandFillVar(bandForLevel(home.level)), color: bandInkVar(bandForLevel(home.level)) }}>
                {bandLabel(bandForLevel(home.level))}
              </span>
              <span className="mt-2 block h-1.5 rounded-full bg-zinc-100">
                <span className="block h-1.5 rounded-full" style={{ width: `${(home.level / 9) * 100}%`, background: levelFillVar(home.level) }} />
              </span>
            </>
          ) : null}
        </Link>
        <Link href="/dashboard/community/streak" className={ui.statCard}>
          <p className="text-xs text-zinc-500">Streak</p>
          <p className="mt-1 font-heading text-lg font-semibold text-zinc-900">{streakCopy}</p>
          {home.sessionsStarted && home.dots.length > 0 ? (
            <span className="mt-3 flex gap-2 px-1">
              {home.dots.map((dot, index) => (
                <span key={index} className="inline-block h-3.5 w-3.5 rounded-full border-2 border-violet-600" style={{ background: dot.filled ? "#7c3aed" : "transparent" }} />
              ))}
            </span>
          ) : null}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TILES.map((tile) => (
          <Link key={tile.href} href={tile.href} className="flex min-h-16 items-center justify-center rounded-2xl bg-white px-2 text-center text-sm font-semibold text-zinc-800 shadow-[0_2px_16px_-4px_rgba(24,24,27,0.07)]">
            {tile.label}
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

      <Link href="/dashboard/community/forum" className="block px-1 text-sm font-semibold text-violet-700">
        Community forum
      </Link>
    </div>
  );
}
