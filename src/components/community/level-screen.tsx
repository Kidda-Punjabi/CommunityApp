import { ExamplePlay } from "@/components/community/example-play";
import { LEVEL_COPY } from "@/lib/community/placement-copy";
import type { LevelExample, LevelView } from "@/lib/community/level-view";
import { formatLevelDate } from "@/lib/community/level-view";
import { LEVEL_CAN_DO, bandForLevel, bandInkVar, bandLabel, levelFillVar, levelInkVar, levelName } from "@/lib/community/levels";
import Link from "next/link";

function LevelScreen({
  backHref,
  children,
  action,
}: {
  backHref: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] flex-col overflow-hidden bg-[#F7F5FC] px-4 pt-[max(0.25rem,env(safe-area-inset-top))] font-[family-name:var(--font-community)] text-[#1F1640]">
      <Link href={backHref} className="inline-flex h-10 items-center text-sm font-semibold text-[#4A3F66]">Back</Link>
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex min-h-0 flex-col gap-2">{children}</div>
        {action}
      </div>
    </div>
  );
}

function Ring({ level, percent }: { level: number; percent: number }) {
  const radius = 26;
  const turn = 2 * Math.PI * radius;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-hidden>
      <circle cx="34" cy="34" r={radius} fill="none" stroke="#4C1D95" strokeWidth="6" />
      <circle
        cx="34"
        cy="34"
        r={radius}
        fill="none"
        stroke="#FDE68A"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${turn} ${turn}`}
        strokeDashoffset={turn * (1 - percent / 100)}
        transform="rotate(-90 34 34)"
      />
      <text x="34" y="40" textAnchor="middle" fontSize="22" fontWeight="800" fill="#ffffff">{level}</text>
    </svg>
  );
}

export function YourLevel({ view }: { view: LevelView }) {
  const band = bandForLevel(view.level);
  const top = view.level >= 9;
  const when = view.placedAt ? formatLevelDate(view.placedAt, view.timezone) : null;
  const origin = view.upFrom == null ? (when ? `Placed on ${when}` : "Placed") : `Up from Level ${view.upFrom} on ${when}`;
  return (
    <LevelScreen backHref="/dashboard/community">
      <section className="rounded-[22px] bg-[#5B21B6] px-3 py-3 text-white">
        <div className="flex items-center gap-3">
          <Ring level={view.level} percent={top ? 100 : view.percent} />
          <div>
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: `var(--kidda-band-${band}-fill)`, color: bandInkVar(band) }}>{bandLabel(band)}</span>
            <p className="mt-1 text-sm font-bold leading-tight">
              {top ? "Top level. Keep it alive and help others in your pod." : `${view.percent}% of the way to Level ${view.level + 1}`}
            </p>
            <p className="mt-1 text-xs text-violet-100">{origin}</p>
          </div>
        </div>
      </section>
      <div className={`grid gap-2 ${view.understanding == null ? "grid-cols-1" : "grid-cols-2"}`}>
        {view.understanding == null ? null : (
          <article className="rounded-[18px] bg-white px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B5F8A]">Understanding</p>
            <p className="font-heading text-xl font-extrabold">Level {view.understanding}</p>
            <p className="text-[11px] text-[#4A3F66]">what you follow</p>
          </article>
        )}
        <article className="rounded-[18px] bg-white px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B5F8A]">Speaking</p>
          <p className="font-heading text-xl font-extrabold">Level {view.speaking ?? view.level}</p>
          <p className="text-[11px] text-[#4A3F66]">sets your level</p>
        </article>
      </div>
      <section>
        <h2 className="text-sm font-extrabold">Your journey</h2>
        <div className="mt-1 flex items-end gap-1">
          {Array.from({ length: 10 }, (_, level) => {
            const state = level < view.level ? "passed" : level === view.level ? "current" : "ahead";
            return (
              <Link key={level} href={`/dashboard/community/level/${level}`} aria-label={`Level ${level}`} className="flex min-h-11 flex-1 flex-col items-center justify-end">
                {state === "current" ? <span className="mb-0.5 text-[10px] font-extrabold text-[#5B21B6]">You</span> : null}
                <span
                  className={`w-full rounded-t-lg ${state === "current" ? "outline outline-2 outline-[#1F1640]" : ""} ${state === "ahead" ? "border-2 border-dashed border-[#C4B5FD]" : ""}`}
                  style={{
                    height: 16 + level * 3,
                    background: state === "ahead" ? "#EDE7FE" : levelFillVar(level),
                  }}
                />
              </Link>
            );
          })}
        </div>
        <div className="mt-1 grid grid-cols-10 text-center text-[9px] font-semibold leading-none text-[#6B5F8A]">
          <span>Sounds</span>
          <span className="col-span-3">Beginner</span>
          <span className="col-span-3">Intermediate</span>
          <span className="col-span-3">Advanced</span>
        </div>
      </section>
      {top ? null : (
        <section>
          <h2 className="text-sm font-extrabold">Your road to Level {view.level + 1}</h2>
          <ol className="mt-1 space-y-1">
            <li className="flex items-center gap-2 rounded-[16px] bg-white px-3 py-1.5 text-xs font-semibold"><span className="text-[#0E9F78]">✓</span>Placed at Level {view.level}</li>
            <li className="flex items-center justify-between rounded-[16px] bg-white px-3 py-1.5 text-xs font-semibold">
              <span>Attend {view.goal} main sessions</span>
              <span className="text-[#6B5F8A]">{view.done} of {view.goal}</span>
            </li>
            <li className="rounded-[16px] bg-white px-3 py-1.5 text-xs font-semibold">
              {view.cooldownUntil ? (
                <p>Not quite yet. Keep coming to sessions and try again on {formatLevelDate(view.cooldownUntil, view.timezone)}</p>
              ) : view.unlocked ? (
                <Link href="/dashboard/community/level/retake" className="flex h-11 items-center justify-center rounded-[14px] bg-[#7C3AED] text-sm font-bold text-white">Retake the level check</Link>
              ) : (
                <p className="text-[#6B5F8A]">Retake the level check · Unlocks at {view.goal}</p>
              )}
            </li>
          </ol>
        </section>
      )}
    </LevelScreen>
  );
}

export function LevelDetail({
  view,
  n,
  example,
  passedOn,
}: {
  view: LevelView;
  n: number;
  example: LevelExample | null;
  passedOn: string | null;
}) {
  const ahead = n - view.level;
  const state = n === view.level ? "current" : n < view.level ? "passed" : "ahead";
  const copy = LEVEL_COPY[n];
  return (
    <LevelScreen
      backHref="/dashboard/community/level"
      action={
        state === "current" ? (
          <Link href="/dashboard/learn" className="flex h-12 items-center justify-center rounded-[18px] bg-[#7C3AED] text-sm font-bold text-white">Practise Level {n} phrases</Link>
        ) : state === "passed" ? (
          <Link href={`/dashboard/community/level/${n}/refresher`} className="flex h-12 items-center justify-center rounded-[18px] bg-[#7C3AED] text-sm font-bold text-white">2-minute refresher</Link>
        ) : (
          <Link href={`/dashboard/community/level/${view.level}`} className="flex h-12 items-center justify-center rounded-[18px] bg-[#7C3AED] text-sm font-bold text-white">Keep working on Level {view.level}</Link>
        )
      }
    >
      <header className="rounded-[22px] px-3 py-3" style={{ background: levelFillVar(n), color: levelInkVar(n) }}>
        <div className="flex items-center gap-3">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/30 text-xl font-extrabold">
            {n}
            {state === "passed" ? <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0E9F78] text-[10px] text-white">✓</span> : null}
          </span>
          <div>
            <p className="text-xs font-bold">{bandLabel(bandForLevel(n))} · Level {n} of 9</p>
            <h1 className="font-heading text-xl font-extrabold leading-tight">{levelName(n)}</h1>
            <p className="text-xs font-bold">{state === "current" ? "You're here" : state === "passed" ? "Passed" : ahead === 1 ? "Next up" : `${ahead} levels ahead`}</p>
          </div>
        </div>
      </header>
      {state === "current" ? (
        <>
          <section className="rounded-[18px] bg-white px-3 py-2">
            <h2 className="text-sm font-extrabold">What you can do now</h2>
            <p className="text-xs leading-snug text-[#4A3F66]">{copy.now}</p>
          </section>
          <Example example={example} title="Sounds like this" />
          <section className="rounded-[18px] bg-white px-3 py-2">
            <h2 className="text-sm font-extrabold">What you&apos;re working on</h2>
            <p className="text-xs leading-snug text-[#4A3F66]">{LEVEL_COPY[view.level].next}</p>
            {view.level < 9 ? (
              <>
                <div className="mt-2 h-1.5 rounded-full bg-[#EDE7FE]"><div className="h-1.5 rounded-full bg-[#7C3AED]" style={{ width: `${view.percent}%` }} /></div>
                <p className="mt-1 text-[11px] font-semibold text-[#6B5F8A]">{view.percent}% there · {view.done} of {view.goal} main sessions</p>
              </>
            ) : null}
          </section>
          {view.pod ? (
            <section className="rounded-[18px] bg-white px-3 py-2">
              <h2 className="text-sm font-extrabold">{view.pod.name}</h2>
              <div className="mt-1 flex gap-1">
                {view.mates.slice(0, 6).map((mate) => (
                  <span key={mate.userId} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F5FC] text-xs font-bold" style={mate.level == null ? undefined : { boxShadow: `0 0 0 2px ${levelFillVar(mate.level)}` }}>{mate.name.slice(0, 1)}</span>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
      {state === "passed" ? (
        <>
          <section className="rounded-[18px] bg-white px-3 py-2">
            <h2 className="text-sm font-extrabold">You can already</h2>
            <ul className="mt-1 space-y-0.5">
              {LEVEL_CAN_DO[n].map((line) => <li key={line} className="text-xs font-semibold text-[#4A3F66]">✓ {line}</li>)}
            </ul>
          </section>
          <Example example={example} title="Sounds like this" />
          <p className="text-xs font-semibold text-[#4A3F66]">{passedOn ? `Behind you since ${formatLevelDate(passedOn, view.timezone)}` : "Behind you"}</p>
        </>
      ) : null}
      {state === "ahead" ? (
        <>
          <section className="rounded-[18px] bg-white px-3 py-2">
            <h2 className="text-sm font-extrabold">What it unlocks</h2>
            <p className="text-xs leading-snug text-[#4A3F66]">{copy.now}</p>
          </section>
          <Example example={example} title={`A taste of Level ${n}`} />
          <section className="rounded-[18px] bg-white px-3 py-2">
            <h2 className="text-sm font-extrabold">The path there</h2>
            <ol className="mt-1 space-y-0.5 text-xs font-semibold text-[#4A3F66]">
              <li>Level {view.level} · {levelName(view.level)}</li>
              {n === view.level + 1 ? null : <li>Level {view.level + 1} · {levelName(view.level + 1)}</li>}
              <li>Level {n} · {levelName(n)}</li>
            </ol>
          </section>
        </>
      ) : null}
    </LevelScreen>
  );
}

function Example({ example, title }: { example: LevelExample | null; title: string }) {
  if (!example) return null;
  return (
    <section className="flex items-center gap-2 rounded-[18px] bg-white px-3 py-2">
      <ExamplePlay url={example.audioUrl} />
      <div>
        <h2 className="text-sm font-extrabold">{title}</h2>
        <p className="text-xs font-semibold">{example.roman}</p>
        <p className="text-[11px] text-[#6B5F8A]">{example.meaning}</p>
      </div>
    </section>
  );
}
