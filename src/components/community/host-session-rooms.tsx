"use client";

import {
  addActivity,
  approveLate,
  approveRooms,
  bringBack,
  moveActivity,
  movePerson,
  removeActivity,
  replaceActivity,
  skipActivity,
  suggestRooms,
} from "@/app/admin/community/breakout-actions";
import type { HostRoom } from "@/lib/community/host-session";
import { bandFillVar, bandInkVar, bandLabel, levelFillVar, levelInkVar } from "@/lib/community/levels";
import {
  ACTIVITY_BANDS,
  ACTIVITY_DESCRIPTIONS,
  ACTIVITY_TITLES,
  type RoomActivityKind,
} from "@/lib/community/room-activities";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = { error?: string } | { ok: true } | { error: string } | { ok: true; rooms: number } | undefined;

function activityTag(status: string, isNext: boolean): { label: string; className: string } {
  if (status === "done") return { label: "Done", className: "bg-emerald-50 text-emerald-700" };
  if (status === "active") return { label: "Now", className: "bg-violet-600 text-white" };
  if (isNext) return { label: "Up next", className: "bg-zinc-100 text-zinc-700" };
  return { label: "Later", className: "bg-zinc-100 text-zinc-500" };
}

type Picker = { mode: "add"; room: HostRoom } | { mode: "replace"; room: HostRoom; activityId: string; current: string } | null;

const PICKER_BANDS = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
] as const;

export function HostSessionRooms({
  occurrenceId,
  rooms,
  running,
  availableKinds = [],
}: {
  occurrenceId: string;
  rooms: HostRoom[];
  running: boolean;
  availableKinds?: RoomActivityKind[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState<HostRoom | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const openRooms = rooms.filter((room) => room.status !== "closed");
  const roomNumbers = openRooms.map((room) => room.roomNumber);
  const canApprove = openRooms.some((room) => room.status === "suggested");

  async function run(action: () => Promise<Result>, after?: string) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    if (after) router.push(after);
    else router.refresh();
  }

  const roomState = (room: HostRoom): "finished" | "bonus" | "working" => {
    if (room.activities.length === 0) return "working";
    const active = room.activities.find((item) => item.status === "active");
    if (!active) return room.activities.every((item) => item.status === "done") ? "finished" : "working";
    return active.kind === "bonus" ? "bonus" : "working";
  };
  const doneRooms = running ? openRooms.filter((room) => roomState(room) !== "working") : [];
  const allDone = running && openRooms.length > 0 && doneRooms.length === openRooms.length;

  const banner = running
    ? { title: "Rooms running.", sub: "Activities move on by themselves when everyone in a room finishes." }
    : openRooms.length > 0
      ? { title: `Suggested: ${openRooms.length} room${openRooms.length === 1 ? "" : "s"}.`, sub: "Grouped by level. Move anyone who needs it, then approve." }
      : { title: "No rooms yet.", sub: "Suggest rooms once people have checked in." };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
        <p className="text-[15px]">
          <span className="font-bold">{banner.title}</span> <span className="text-zinc-500">{banner.sub}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {!running ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => suggestRooms(occurrenceId))}
                className="min-h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-800 disabled:opacity-50"
              >
                {openRooms.length > 0 ? "Suggest again" : "Suggest rooms"}
              </button>
              <button
                type="button"
                disabled={pending || !canApprove}
                onClick={() => run(() => approveRooms(occurrenceId), `/admin/community/session/${occurrenceId}?step=running`)}
                className="min-h-11 rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white disabled:opacity-50"
              >
                Approve rooms
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => bringBack(occurrenceId), `/admin/community/session/${occurrenceId}?step=wrap`)}
              className={`min-h-11 rounded-xl px-4 text-sm font-bold disabled:opacity-50 ${
                allDone ? "bg-emerald-700 text-white" : "border border-zinc-200 bg-white text-zinc-800"
              }`}
            >
              Bring everyone back
            </button>
          )}
        </div>
      </div>
      {allDone ? (
        <div className="rounded-2xl bg-emerald-700 px-5 py-4 text-white">
          <p className="font-heading text-xl font-extrabold">All rooms are done.</p>
          <p className="text-[15px] text-emerald-50">
            Add another activity to a room, or tap Bring everyone back and close the breakout rooms in Meet.
          </p>
        </div>
      ) : running && doneRooms.length > 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-emerald-900">
          <p className="text-[15px] font-bold">
            {doneRooms.map((room) => `Room ${room.roomNumber}`).join(", ")} {doneRooms.length === 1 ? "has" : "have"} finished the set and{" "}
            {doneRooms.length === 1 ? "is" : "are"} waiting for you.
          </p>
        </div>
      ) : null}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {openRooms.map((room) => {
          const nextIndex = room.activities.findIndex((item) => item.status !== "done" && item.status !== "active");
          const state = running ? roomState(room) : "working";
          return (
            <section
              key={room.id}
              className={`flex flex-col gap-3 rounded-[20px] border bg-white p-4 ${
                state === "working" ? "border-zinc-200" : "border-2 border-emerald-600"
              }`}
            >
              {state !== "working" ? (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                  {state === "finished"
                    ? "Finished · waiting for you to bring them back"
                    : "Set done · playing the bonus game until you bring them back"}
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-lg font-extrabold">Room {room.roomNumber}</h3>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-bold"
                  style={{ background: bandFillVar(room.band), color: bandInkVar(room.band) }}
                >
                  {bandLabel(room.band)}
                </span>
              </div>

              <ul className="space-y-1.5">
                {room.members.map((member) => (
                  <li key={member.userId} className="flex min-h-10 flex-wrap items-center gap-2 rounded-xl bg-zinc-50 px-2.5">
                    <span className="text-sm font-bold">{member.name}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: levelFillVar(member.level), color: levelInkVar(member.level) }}
                    >
                      L{member.level}
                    </span>
                    {member.pending ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="text-xs font-bold text-violet-700"
                        onClick={() => run(() => approveLate(occurrenceId, member.userId))}
                      >
                        Approve late arrival
                      </button>
                    ) : null}
                    <label className="ml-auto flex items-center gap-1 text-xs text-zinc-500">
                      <span className="sr-only">Move {member.name} to</span>
                      <select
                        className="h-9 rounded-lg border border-zinc-200 bg-white px-1.5 text-xs"
                        defaultValue=""
                        disabled={pending}
                        onChange={(event) => {
                          const target = event.target.value;
                          if (!target) return;
                          void run(() => movePerson(occurrenceId, member.userId, target));
                          event.target.value = "";
                        }}
                      >
                        <option value="">Move</option>
                        {roomNumbers
                          .filter((number) => number !== room.roomNumber)
                          .map((number) => (
                            <option key={number} value={String(number)}>
                              Room {number}
                            </option>
                          ))}
                        <option value="new">New room</option>
                      </select>
                    </label>
                  </li>
                ))}
              </ul>

              <div className="space-y-1.5">
                <p className="text-xs font-bold text-zinc-500">Activities</p>
                {room.activities.length === 0 ? (
                  <p className="text-sm text-zinc-500">Chosen when the room is approved.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {room.activities.map((activity, index) => {
                      const tag = activityTag(activity.status, index === nextIndex);
                      const editable = running && activity.status === "locked";
                      const prevLocked = index > 0 && room.activities[index - 1].status === "locked";
                      const nextLocked = index < room.activities.length - 1 && room.activities[index + 1].status === "locked";
                      return (
                        <li
                          key={activity.id}
                          className={`rounded-xl px-2.5 py-1.5 text-sm font-bold ${
                            activity.status === "active" ? "border-2 border-violet-600 bg-violet-50" : "bg-zinc-50"
                          } ${activity.status === "done" ? "text-zinc-400" : "text-zinc-900"}`}
                        >
                          <div className="flex min-h-8 items-center gap-2">
                            <span className="w-4 text-xs text-zinc-400">{index + 1}</span>
                            <span className="flex-1">{activity.title}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tag.className}`}>{tag.label}</span>
                          </div>
                          {editable ? (
                            <div className="mt-1 flex flex-wrap items-center gap-1 pl-6">
                              <button
                                type="button"
                                aria-label={`Move ${activity.title} earlier`}
                                disabled={pending || !prevLocked}
                                onClick={() => run(() => moveActivity(activity.id, "up"))}
                                className="min-h-8 min-w-8 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700 disabled:opacity-30"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                aria-label={`Move ${activity.title} later`}
                                disabled={pending || !nextLocked}
                                onClick={() => run(() => moveActivity(activity.id, "down"))}
                                className="min-h-8 min-w-8 rounded-lg border border-zinc-200 bg-white text-xs font-bold text-zinc-700 disabled:opacity-30"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => setPicker({ mode: "replace", room, activityId: activity.id, current: activity.kind })}
                                className="min-h-8 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-bold text-violet-700"
                              >
                                Change
                              </button>
                              <button
                                type="button"
                                disabled={pending}
                                onClick={() => run(() => removeActivity(activity.id))}
                                className="min-h-8 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-bold text-zinc-600"
                              >
                                Remove
                              </button>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                )}
                {running && room.status === "approved" && availableKinds.length > 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setPicker({ mode: "add", room })}
                    className="mt-1 flex min-h-10 w-full items-center justify-center rounded-xl border-2 border-dashed border-violet-300 text-sm font-bold text-violet-700"
                  >
                    {state === "working" ? "+ Add activity next" : "+ Start another activity now"}
                  </button>
                ) : null}
              </div>

              {running && room.signoff && state === "working" ? (
                <div className="flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
                  <span className="text-[13px] text-zinc-600">
                    Sign-off {room.signoff.done} of {room.signoff.of}
                    {room.signoff.waitingFor.length > 0 && room.signoff.waitingFor.length <= 2
                      ? ` · waiting for ${room.signoff.waitingFor.join(" and ")}`
                      : ""}
                  </span>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirmSkip(room)}
                    className="min-h-9 rounded-lg border border-zinc-200 bg-white px-3 text-[13px] font-bold text-zinc-700"
                  >
                    Skip
                  </button>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {!running && openRooms.length > 0 ? (
        <p className="text-[13px] text-zinc-500">
          {openRooms.length === 1
            ? "One room: everyone stays in the main call."
            : `After approving, open ${openRooms.length} breakout rooms in Meet with the same numbers.`}
        </p>
      ) : null}

      {picker ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/45 px-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="picker-title"
            className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-[22px] bg-white p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="picker-title" className="font-heading text-xl font-extrabold">
                  {picker.mode === "add" ? `Add an activity to Room ${picker.room.roomNumber}` : `Change activity in Room ${picker.room.roomNumber}`}
                </h2>
                <p className="text-sm text-zinc-500">
                  {picker.mode === "add"
                    ? roomState(picker.room) === "working"
                      ? "It goes in as the room's next activity."
                      : "It starts straight away on everyone's phone in the room."
                    : "Everything uses this week's topic."}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setPicker(null)}
                className="min-h-10 min-w-10 rounded-xl bg-zinc-100 text-lg font-bold text-zinc-700"
              >
                ×
              </button>
            </div>
            {PICKER_BANDS.map((band) => {
              const kinds = availableKinds.filter((kind) => ACTIVITY_BANDS[kind].includes(band.key));
              if (kinds.length === 0) return null;
              const isRoomBand = picker.room.band === band.key;
              return (
                <div key={band.key} className="space-y-2">
                  <p className="text-[13px] font-extrabold" style={{ color: bandInkVar(band.key) }}>
                    {band.label}
                    {isRoomBand ? " · this room's level" : ""}
                  </p>
                  {kinds.map((kind) => {
                    const isCurrent = picker.mode === "replace" && picker.current === kind;
                    return (
                      <button
                        key={`${band.key}-${kind}`}
                        type="button"
                        disabled={pending || isCurrent}
                        onClick={() => {
                          const target = picker;
                          setPicker(null);
                          void run(() =>
                            target.mode === "add" ? addActivity(target.room.id, kind) : replaceActivity(target.activityId, kind)
                          );
                        }}
                        className={`flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left ${
                          isCurrent ? "border-2 border-violet-600 bg-violet-50" : "border border-zinc-200 bg-white hover:bg-zinc-50"
                        }`}
                      >
                        <span className="text-[15px] font-bold text-zinc-900">
                          {ACTIVITY_TITLES[kind]}
                          {isCurrent ? " · current" : ""}
                        </span>
                        <span className="text-[13px] text-zinc-500">{ACTIVITY_DESCRIPTIONS[kind]}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {confirmSkip ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/45 px-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="skip-title" className="w-full max-w-md space-y-3 rounded-[22px] bg-white p-6">
            <h2 id="skip-title" className="font-heading text-xl font-extrabold">
              Skip {confirmSkip.activities.find((item) => item.status === "active")?.title ?? "this activity"} for Room {confirmSkip.roomNumber}?
            </h2>
            <p className="text-sm text-zinc-600">Everyone in the room moves on to the next activity, even if they haven&apos;t finished.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmSkip(null)}
                className="min-h-11 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-900"
              >
                Keep going
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const room = confirmSkip;
                  setConfirmSkip(null);
                  void run(() => skipActivity(room.id));
                }}
                className="min-h-11 rounded-xl bg-zinc-900 px-4 text-sm font-bold text-white"
              >
                Skip activity
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
