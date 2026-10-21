"use client";

import { castDebateVote, markActivityDone, openPointRace } from "@/app/dashboard/community/breakout-actions";
import { RoomRefresh } from "@/components/community/room-refresh";
import type { MemberRoomView } from "@/lib/community/breakout";
import { bandFillVar, bandInkVar, bandLabel } from "@/lib/community/levels";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LiveRoom({ view, userId }: { view: MemberRoomView; userId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active = view.activities.find((item) => item.status === "active") ?? null;
  const signed = new Set(view.signedUserIds);
  const iSigned = signed.has(userId);
  const needsVote = active?.kind === "warmup_debate" && !view.myVote;

  async function run(action: () => Promise<{ error?: string; href?: string } | { ok: true; href?: string } | { error: string }>) {
    setPending(true);
    setError(null);
    const result = await action();
    setPending(false);
    if ("href" in result && result.href) {
      router.push(result.href);
      return;
    }
    if ("error" in result && result.error) setError(result.error);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3">
      <RoomRefresh channelId={view.occurrenceId} />
      {view.phase === "waiting" ? (
        <section className="rounded-[24px] bg-[#5B21B6] p-4 text-white">
          <p className="font-heading text-2xl font-extrabold leading-tight">{"You're checked in."}</p>
          <p className="mt-2 text-base text-violet-100">Arsh is setting up rooms.</p>
          <p className="mt-3 text-sm font-semibold">{view.checkedInCount} checked in</p>
        </section>
      ) : (
        <>
          <section
            className="rounded-[24px] p-4"
            style={{ background: bandFillVar(view.band ?? "beginner"), color: bandInkVar(view.band ?? "beginner") }}
          >
            <p className="font-heading text-2xl font-extrabold">
              Room {view.roomNumber} · {bandLabel(view.band ?? "beginner")}
            </p>
            <p className="mt-2 text-sm font-semibold">{view.names.join(", ")}</p>
            <p className="mt-3 text-base font-bold">Go to Breakout room {view.roomNumber} in Meet</p>
            {view.meetUrl ? (
              <a href={view.meetUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-12 items-center rounded-2xl bg-white px-4 text-sm font-bold text-[#5B21B6]">
                Open Meet
              </a>
            ) : null}
          </section>
          {active ? (
            <ActivityCard
              key={active.id}
              activity={active}
              total={view.activities.length}
              people={view.people}
              signed={signed}
              iSigned={iSigned}
              needsVote={needsVote}
              myVote={view.myVote}
              voteCount={view.votes.length}
              pending={pending}
              onVote={(choice) => run(() => castDebateVote(active.id, choice))}
              onDone={() => run(() => markActivityDone(active.id))}
              onRace={() => run(() => openPointRace(active.id))}
            />
          ) : (
            <section className="rounded-[24px] bg-white p-4">
              <p className="font-heading text-xl font-extrabold text-[#1F1640]">{"That's the set."}</p>
              <p className="mt-1 text-sm text-[#6B5F8A]">Stay in the room until Arsh brings everyone back.</p>
            </section>
          )}
        </>
      )}
      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

function ActivityCard({
  activity,
  total,
  people,
  signed,
  iSigned,
  needsVote,
  myVote,
  voteCount,
  pending,
  onVote,
  onDone,
  onRace,
}: {
  activity: MemberRoomView["activities"][number];
  total: number;
  people: { userId: string; name: string }[];
  signed: Set<string>;
  iSigned: boolean;
  needsVote: boolean;
  myVote: "a" | "b" | null;
  voteCount: number;
  pending: boolean;
  onVote: (choice: "a" | "b") => void;
  onDone: () => void;
  onRace: () => void;
}) {
  const payload = activity.payload;
  const instruction = typeof payload.instruction === "string" ? payload.instruction : "";
  const prompts = Array.isArray(payload.prompts) ? (payload.prompts as { front?: string; back?: string }[]) : [];
  const [promptIndex, setPromptIndex] = useState(0);
  const prompt = prompts[promptIndex];
  const heading = activity.kind === "warmup_debate" && typeof payload.prompt === "string" ? payload.prompt : activity.title;

  return (
    <section className="rounded-[24px] bg-white p-4 text-[#1F1640]">
      <p className="text-xs font-bold uppercase tracking-wide text-[#6B5F8A]">
        {activity.position + 1} of {total}
      </p>
      <h2 className="mt-1 font-heading text-2xl font-extrabold">{heading}</h2>
      {typeof payload.romanised === "string" && payload.romanised ? (
        <p className="mt-1 text-sm text-[#6B5F8A]">{payload.romanised}</p>
      ) : null}
      <p className="mt-2 text-base">{instruction}</p>
      {activity.kind === "warmup_debate" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <VoteButton label={String(payload.optionA ?? "A")} selected={myVote === "a"} disabled={pending} onClick={() => onVote("a")} />
          <VoteButton label={String(payload.optionB ?? "B")} selected={myVote === "b"} disabled={pending} onClick={() => onVote("b")} />
          <p className="col-span-2 text-sm text-[#6B5F8A]">{voteCount} voted</p>
        </div>
      ) : null}
      {activity.kind === "flashcards" && payload.lessonId && payload.deckId ? (
        <a className={actionClass} href={`/dashboard/practice/flashcards/${payload.lessonId}/${payload.deckId}/study`}>
          Open flashcards
        </a>
      ) : null}
      {activity.kind === "quiz" && payload.quizId ? (
        <a className={actionClass} href={`/dashboard/practice/quiz/${payload.quizId}`}>
          Open quiz
        </a>
      ) : null}
      {activity.kind === "point_race" ? (
        <button type="button" className={actionClass} disabled={pending} onClick={onRace}>
          {payload.joinCode ? `Join game ${payload.joinCode}` : "Start Point Race"}
        </button>
      ) : null}
      {activity.kind === "speak_it" ? (
        <a className={actionClass} href="/dashboard/games/speaking-practice">
          Open Speak It
        </a>
      ) : null}
      {activity.kind === "speaking_prompts" && prompt ? (
        <div className="mt-4 rounded-2xl bg-[#F7F5FC] p-3">
          <p className="text-lg font-bold">{prompt.front}</p>
          <p className="mt-2 text-base text-[#5B21B6]">{prompt.back}</p>
          {prompts.length > 1 ? (
            <button
              type="button"
              className="mt-3 text-sm font-bold text-[#5B21B6]"
              onClick={() => setPromptIndex((index) => (index + 1) % prompts.length)}
            >
              Next prompt
            </button>
          ) : null}
        </div>
      ) : null}
      {activity.kind === "bonus" ? (
        <a className={actionClass} href="/dashboard/group-games">
          Play a game
        </a>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {people.map((person) => (
          <span
            key={person.userId}
            className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full px-2 text-sm font-bold ${signed.has(person.userId) ? "bg-[#5B21B6] text-white" : "bg-[#F7F5FC]"}`}
          >
            {person.name.slice(0, 1)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm font-semibold text-[#6B5F8A]">
        {signed.size} of {people.length} done
      </p>
      <button
        type="button"
        disabled={pending || iSigned || needsVote}
        onClick={onDone}
        className="mt-3 inline-flex h-14 w-full items-center justify-center rounded-[18px] bg-[#5B21B6] text-base font-bold text-white disabled:opacity-40"
      >
        {iSigned ? "You're done" : "Done"}
      </button>
    </section>
  );
}

function VoteButton({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-14 rounded-2xl px-3 text-base font-bold ${selected ? "bg-[#5B21B6] text-white" : "bg-[#F7F5FC] text-[#1F1640]"}`}
    >
      {label}
    </button>
  );
}

const actionClass =
  "mt-4 inline-flex h-12 items-center justify-center rounded-2xl bg-[#FDE68A] px-4 text-sm font-bold text-[#3B1A8C]";
