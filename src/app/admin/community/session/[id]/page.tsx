import { addCheckIn, endSession, startSession } from "@/app/admin/community/actions";
import { HostMainRoom } from "@/components/community/host-main-room";
import { HostSessionRooms } from "@/components/community/host-session-rooms";
import { CommunityLiveSync } from "@/components/community/room-refresh";
import type { CommunityBand } from "@/lib/community/constants";
import { bandOfPerson, loadHostSession, type HostStep } from "@/lib/community/host-session";
import { bandInkVar, bandLabel, levelFillVar, levelInkVar } from "@/lib/community/levels";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import Link from "next/link";
import { notFound } from "next/navigation";

const STEPS: { key: HostStep; label: string }[] = [
  { key: "checkin", label: "Check-in" },
  { key: "rooms", label: "Rooms" },
  { key: "running", label: "Running" },
  { key: "wrap", label: "Wrap up" },
];

const BANDS: CommunityBand[] = ["beginner", "intermediate", "advanced"];

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
}

export default async function HostSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = await params;
  const { step: rawStep } = await searchParams;
  const view = await loadHostSession(createServiceRoleClient(), id);
  if (!view) notFound();

  const live = view.status === "live";
  const step: HostStep = STEPS.some((item) => item.key === rawStep) ? (rawStep as HostStep) : view.autoStep;
  const stepIndex = STEPS.findIndex((item) => item.key === step);
  const autoIndex = STEPS.findIndex((item) => item.key === view.autoStep);
  const liveFor = minutesSince(view.startedAt);
  const when = new Date(view.startsAt).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
  const lateCount = view.checkins.filter((row) => row.isLate).length;
  const activities = view.rooms.flatMap((room) => room.activities).filter((item) => item.kind !== "bonus");
  const activitiesDone = activities.filter((item) => item.status === "done").length;

  return (
    <div className="space-y-5 pb-4">
      {live ? (
        <CommunityLiveSync
          channelId={`host-${view.occurrenceId}`}
          occurrenceId={view.occurrenceId}
          poll={view.autoStep === "running"}
        />
      ) : null}

      <header className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/community/today"
            className="inline-flex min-h-10 items-center rounded-xl border border-zinc-200 px-3 text-sm font-bold text-zinc-700"
          >
            Community
          </Link>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-zinc-500">
              {view.sessionTitle}
              {view.isTest ? " · staff-only test" : ""} · {when}
              {live && liveFor != null ? ` · live ${liveFor} min` : ""}
              {view.status === "ended" ? " · ended" : ""}
            </p>
            <h1 className="font-heading text-xl font-extrabold text-zinc-900">
              Week {view.week}
              {view.topic ? ` · ${view.topic}` : ""}
            </h1>
          </div>
        </div>

        <nav aria-label="Session steps" className="flex flex-wrap gap-1.5">
          {STEPS.map((item, index) => (
            <Link
              key={item.key}
              href={`/admin/community/session/${view.occurrenceId}?step=${item.key}`}
              aria-current={index === stepIndex ? "step" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] font-bold ${
                index === stepIndex
                  ? "bg-violet-600 text-white"
                  : index < autoIndex
                    ? "bg-emerald-50 text-emerald-700"
                    : "border border-zinc-200 bg-white text-zinc-500"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {live && view.checkinCode ? (
            <Link
              href={`/admin/community/today/code?occurrence=${view.occurrenceId}`}
              className="rounded-xl bg-violet-50 px-3 py-2 text-[13px] font-extrabold tracking-[0.08em] text-violet-800"
            >
              CODE {view.checkinCode}
            </Link>
          ) : null}
          {live ? (
            <form
              action={async () => {
                "use server";
                await endSession(view.occurrenceId);
                const { redirect } = await import("next/navigation");
                redirect(`/admin/community/session/${view.occurrenceId}?step=wrap`);
              }}
            >
              <button
                type="submit"
                className="min-h-10 rounded-xl border border-red-200 bg-white px-3.5 text-sm font-bold text-red-700"
              >
                End session
              </button>
            </form>
          ) : null}
        </div>
      </header>

      {view.status === "scheduled" ? (
        <section className="flex flex-col items-start gap-3 rounded-3xl border border-zinc-200 bg-white p-6">
          <p className="text-lg font-bold">This session hasn&apos;t started yet.</p>
          <form
            action={async () => {
              "use server";
              await startSession(view.occurrenceId);
            }}
          >
            <button type="submit" className="min-h-12 rounded-2xl bg-violet-600 px-6 text-base font-bold text-white">
              Start session
            </button>
          </form>
        </section>
      ) : null}

      {view.status !== "scheduled" && step === "checkin" ? (
        <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
          <section className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-violet-700 p-7 text-center text-white">
            <p className="text-sm font-bold uppercase tracking-[0.1em] text-violet-200">Check-in code</p>
            <p className="font-heading text-7xl font-extrabold leading-none tracking-[0.08em] sm:text-8xl">
              {view.checkinCode ?? "----"}
            </p>
            <p className="max-w-xs text-base text-violet-100">Community tab, then Check in, then type this code.</p>
            {live ? (
              <Link
                href={`/admin/community/today/code?occurrence=${view.occurrenceId}`}
                className="mt-1 inline-flex min-h-12 items-center rounded-2xl border border-white/50 px-5 text-[15px] font-bold text-white"
              >
                Full screen to share in Meet
              </Link>
            ) : null}
            <p className="text-[13px] text-violet-200">Check-ins after 5 minutes count as late</p>
          </section>

          <section className="flex flex-col gap-4 rounded-3xl border border-zinc-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-heading text-3xl font-extrabold">{view.checkins.length} checked in</p>
                <p className="text-sm text-zinc-500">
                  Updates as people arrive
                  {view.missing.length > 0 ? ` · ${view.missing.length} not here yet` : ""}
                </p>
              </div>
              {live ? (
                <form
                  action={async (formData) => {
                    "use server";
                    await addCheckIn(view.occurrenceId, String(formData.get("email") ?? ""));
                  }}
                  className="flex gap-2"
                >
                  <label htmlFor="add-email" className="sr-only">
                    Add someone by email
                  </label>
                  <input
                    id="add-email"
                    name="email"
                    type="email"
                    required
                    placeholder="Add someone by email"
                    className="h-11 w-56 rounded-xl border border-zinc-200 px-3 text-[16px]"
                  />
                  <button type="submit" className="min-h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold">
                    Add
                  </button>
                </form>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {BANDS.map((band) => {
                const people = view.checkins.filter((row) => bandOfPerson(row.level) === band);
                return (
                  <div key={band} className="space-y-2">
                    <p className="text-[13px] font-extrabold" style={{ color: bandInkVar(band) }}>
                      {bandLabel(band)} · {people.length}
                    </p>
                    {people.map((row) => (
                      <div key={row.userId} className="flex min-h-11 items-center gap-2 rounded-xl bg-zinc-50 px-2.5">
                        <span className="flex-1 truncate text-sm font-bold">{row.name}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{ background: levelFillVar(row.level), color: levelInkVar(row.level) }}
                        >
                          L{row.level}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {row.time}
                          {row.isLate ? " late" : ""}
                          {row.added ? " · added" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {view.missing.length > 0 ? (
              <p className="text-sm text-zinc-500">
                <span className="font-bold text-zinc-700">Not here yet:</span> {view.missing.map((row) => row.name.split(" ")[0]).join(", ")}
              </p>
            ) : null}

            {live ? (
              <div className="flex justify-end border-t border-zinc-100 pt-4">
                <Link
                  href={`/admin/community/session/${view.occurrenceId}?step=rooms`}
                  className="inline-flex min-h-12 items-center rounded-2xl bg-violet-600 px-6 text-base font-bold text-white"
                >
                  Next: breakout rooms
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {view.status !== "scheduled" && (step === "rooms" || step === "running") ? (
        <HostSessionRooms
          occurrenceId={view.occurrenceId}
          rooms={view.rooms}
          running={step === "running"}
          availableKinds={view.availableKinds}
        />
      ) : null}

      {view.status !== "scheduled" && step === "wrap" ? (
        <div className="grid gap-5 lg:grid-cols-[2fr_3fr]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <section className="rounded-[20px] border border-zinc-200 bg-white p-4">
                <p className="font-heading text-3xl font-extrabold">{view.checkins.length}</p>
                <p className="text-[13px] text-zinc-500">attended{lateCount ? ` (${lateCount} late)` : ""}</p>
              </section>
              <section className="rounded-[20px] border border-zinc-200 bg-white p-4">
                <p className="font-heading text-3xl font-extrabold">
                  {activitiesDone} of {activities.length}
                </p>
                <p className="text-[13px] text-zinc-500">room activities finished</p>
              </section>
              <section className="rounded-[20px] border border-zinc-200 bg-white p-4">
                <p className="font-heading text-3xl font-extrabold">{view.rooms.length}</p>
                <p className="text-[13px] text-zinc-500">breakout rooms</p>
              </section>
              <section className="rounded-[20px] border border-zinc-200 bg-white p-4">
                <p className="font-heading text-3xl font-extrabold">{view.missing.length}</p>
                <p className="text-[13px] text-zinc-500">main-session members missed</p>
              </section>
            </div>
            {view.missing.length > 0 ? (
              <section className="rounded-[20px] border border-zinc-200 bg-white p-4">
                <p className="text-[15px] font-bold">Missed</p>
                <p className="mt-1 text-sm text-zinc-600">{view.missing.map((row) => row.name).join(", ")}</p>
              </section>
            ) : null}
          </div>
          <div className="flex flex-col gap-4">
            {live ? (
              <HostMainRoom
                occurrenceId={view.occurrenceId}
                inMainRoom={Boolean(view.mainRoomAt)}
                groupGame={view.groupGame}
                hadRooms={view.rooms.length > 0}
              />
            ) : null}
            <section className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-6">
              <p className="font-heading text-lg font-extrabold">{live ? "3 · End the session" : "Session ended"}</p>
              <p className="text-sm text-zinc-500">
                {live
                  ? "When you're finished with everyone, end the session. That closes the session and any rooms. Check-ins and XP are already saved."
                  : "Rooms are closed and attendance is saved."}
              </p>
              {live ? (
                <form
                  action={async () => {
                    "use server";
                    await endSession(view.occurrenceId);
                    const { redirect } = await import("next/navigation");
                    redirect(`/admin/community/session/${view.occurrenceId}?step=wrap`);
                  }}
                >
                  <button type="submit" className="min-h-12 rounded-2xl bg-zinc-900 px-6 text-base font-bold text-white">
                    End session
                  </button>
                </form>
              ) : (
                <Link
                  href="/admin/community/today"
                  className="inline-flex min-h-12 w-fit items-center rounded-2xl bg-zinc-900 px-6 text-base font-bold text-white"
                >
                  Back to Community
                </Link>
              )}
            </section>
            {view.feedback.available ? (
              <section className="flex flex-col gap-3 rounded-3xl border border-zinc-200 bg-white p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-heading text-lg font-extrabold">Feedback</p>
                  {view.status === "ended" ? (
                    <p className="text-sm font-bold text-emerald-700">
                      {view.feedback.sent.length} of {view.feedback.sent.length + view.feedback.notSent.length} sent
                      {view.feedback.sent.length > 0
                        ? ` · ${view.feedback.sent.filter((row) => row.notion).length} in Notion`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm text-zinc-500">
                  {view.status === "ended"
                    ? "Everyone who checked in got a notification and a feedback card on their Community tab. Answers go to the feedback database and Notion like class feedback."
                    : "When you end the session, everyone who checked in gets the standard feedback form."}
                </p>
                {view.status === "ended" ? (
                  <ul className="divide-y divide-zinc-100">
                    {view.feedback.sent.map((row) => (
                      <li key={row.name} className="flex min-h-11 items-center gap-3 text-sm">
                        <span className="w-32 truncate font-bold">{row.name}</span>
                        <span className="flex-1 text-zinc-600">Relevance · tutor · confidence: {row.scores}</span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.notion ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                          {row.notion ? "In Notion" : "Saved, Notion pending"}
                        </span>
                      </li>
                    ))}
                    {view.feedback.notSent.map((name) => (
                      <li key={name} className="flex min-h-11 items-center gap-3 text-sm">
                        <span className="w-32 truncate font-bold">{name}</span>
                        <span className="flex-1 text-zinc-400">Not sent yet</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
