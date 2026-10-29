"use client";

import {
  castDebateVote,
  markActivityDone,
  openPointRace,
  openRoomGame,
  skipSpeaker,
  type BonusGameType,
} from "@/app/dashboard/community/breakout-actions";
import { CommunityLiveSync } from "@/components/community/room-refresh";
import type { MemberRoomView } from "@/lib/community/breakout";
import { bandFillVar, bandInkVar, bandLabel } from "@/lib/community/levels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// The warm-up debate has its own vote-then-explain controls (DebateFlow).
const SPOKEN = new Set(["speaking_prompts", "bonus"]);

function activityHref(path: string, activityId: string) {
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}roomActivity=${encodeURIComponent(activityId)}`;
}

export function LiveRoom({
  view,
  userId,
  needsOnboarding = false,
}: {
  view: MemberRoomView;
  userId: string;
  needsOnboarding?: boolean;
}) {
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
      router.push(active ? activityHref(result.href, active.id) : result.href);
      return;
    }
    if ("error" in result && result.error) setError(result.error);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-3">
      <CommunityLiveSync
        channelId={view.roomId ?? view.occurrenceId}
        occurrenceId={view.occurrenceId}
        roomId={view.roomId}
        activityId={active?.id ?? null}
        poll={view.phase === "waiting"}
      />
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
            {view.approvedRoomCount >= 2 ? (
              view.meetUrl ? (
                <a href={view.meetUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-12 items-center rounded-2xl bg-white px-4 text-sm font-bold text-[#5B21B6]">
                  Open breakout room in Meet
                </a>
              ) : null
            ) : (
              <p className="mt-3 text-base font-bold">Stay in the main call</p>
            )}
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
              votes={view.votes}
              pending={pending}
              onVote={(choice) => run(() => castDebateVote(active.id, choice))}
              onDone={() => run(() => markActivityDone(active.id))}
              onSkip={(speakerId) => run(() => skipSpeaker(active.id, speakerId))}
              userId={userId}
              onRace={() => run(() => openPointRace(active.id))}
              onBonusGame={(game) => run(() => openRoomGame(active.id, game))}
            />
          ) : (
            <section className="rounded-[24px] bg-white p-4">
              <p className="font-heading text-xl font-extrabold text-[#1F1640]">{"That's the set."}</p>
              <p className="mt-1 text-sm text-[#6B5F8A]">Stay in the room until Arsh brings everyone back.</p>
            </section>
          )}
        </>
      )}
      {needsOnboarding ? (
        <Link href="/dashboard/community/welcome" className="text-sm font-bold text-[#5B21B6]">
          Finish onboarding when you can
        </Link>
      ) : null}
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
  votes,
  pending,
  onVote,
  onDone,
  onSkip,
  userId,
  onRace,
  onBonusGame,
}: {
  activity: MemberRoomView["activities"][number];
  total: number;
  people: { userId: string; name: string }[];
  signed: Set<string>;
  iSigned: boolean;
  needsVote: boolean;
  myVote: "a" | "b" | null;
  votes: { userId: string; choice: "a" | "b" }[];
  pending: boolean;
  onVote: (choice: "a" | "b") => void;
  onDone: () => void;
  onSkip: (speakerId: string) => void;
  userId: string;
  onRace: () => void;
  onBonusGame: (game: BonusGameType) => void;
}) {
  const payload = activity.payload;
  const instruction =
    activity.kind === "warmup_debate"
      ? "Vote first. Then explain in Punjabi why you voted the way you did."
      : typeof payload.instruction === "string"
        ? payload.instruction
        : "";
  const waiting = people.filter((person) => !signed.has(person.userId)).map((person) => person.name);
  const namesFor = (choice: "a" | "b") =>
    votes
      .filter((vote) => vote.choice === choice)
      .map((vote) => people.find((person) => person.userId === vote.userId)?.name ?? "Member");
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
        <DebateFlow
          optionA={String(payload.optionA ?? "A")}
          optionB={String(payload.optionB ?? "B")}
          people={people}
          votes={votes}
          myVote={myVote}
          signed={signed}
          userId={userId}
          pending={pending}
          namesFor={namesFor}
          onVote={onVote}
          onDone={onDone}
          onSkip={onSkip}
        />
      ) : null}
      {activity.kind === "flashcards" && payload.lessonId && payload.deckId ? (
        <>
          <a
            className={actionClass}
            href={activityHref(
              `/dashboard/practice/flashcards/${payload.lessonId}/${payload.deckId}/study${
                typeof payload.cardType === "string" ? `?type=${encodeURIComponent(payload.cardType)}` : ""
              }`,
              activity.id
            )}
          >
            Open flashcards
          </a>
          <a className={actionClass} href={activityHref(`/dashboard/practice/flashcards/${payload.lessonId}/${payload.deckId}/match`, activity.id)}>
            Open match
          </a>
        </>
      ) : null}
      {activity.kind === "quiz" && payload.quizId ? (
        <a className={actionClass} href={activityHref(`/dashboard/practice/quiz/${payload.quizId}`, activity.id)}>
          Open quiz
        </a>
      ) : null}
      {activity.kind === "point_race" ? (
        <button type="button" className={actionClass} disabled={pending} onClick={onRace}>
          {payload.joinCode ? `Join game ${payload.joinCode}` : "Start Point Race"}
        </button>
      ) : null}
      {activity.kind === "speak_it" ? (
        <a className={actionClass} href={activityHref("/dashboard/games/speaking-practice", activity.id)}>
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
        <BonusGames
          joinCode={typeof payload.joinCode === "string" ? payload.joinCode : null}
          gameType={typeof payload.gameType === "string" ? payload.gameType : null}
          pending={pending}
          onPick={onBonusGame}
        />
      ) : null}
      {activity.kind !== "warmup_debate" ? (
      <>
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
        {waiting.length === 0 ? "Everyone's done" : `Waiting for ${waiting.join(", ")}`}
      </p>
      </>
      ) : null}
      {SPOKEN.has(activity.kind) ? (
        <button
          type="button"
          disabled={pending || iSigned || needsVote}
          onClick={onDone}
          className="mt-3 inline-flex h-14 w-full items-center justify-center rounded-[18px] bg-[#5B21B6] text-base font-bold text-white disabled:opacity-40"
        >
          {iSigned ? "You're done" : "We've done this"}
        </button>
      ) : null}
    </section>
  );
}

const BONUS_GAME_LABELS: Record<BonusGameType, string> = {
  buzz_in: "Buzz-in",
  point_race: "Point Race",
  sentence_builder_group: "Sentence Builder",
};

function BonusGames({
  joinCode,
  gameType,
  pending,
  onPick,
}: {
  joinCode: string | null;
  gameType: string | null;
  pending: boolean;
  onPick: (game: BonusGameType) => void;
}) {
  const current = gameType && gameType in BONUS_GAME_LABELS ? (gameType as BonusGameType) : null;
  return (
    <div className="mt-4 space-y-2">
      {current && joinCode ? (
        <button type="button" className={`${actionClass} mt-0 w-full`} disabled={pending} onClick={() => onPick(current)}>
          Join {BONUS_GAME_LABELS[current]} · {joinCode}
        </button>
      ) : null}
      <p className="text-sm font-semibold text-[#6B5F8A]">
        {current ? "Or start a new game when that one ends:" : "Pick a game. The first person to tap hosts it."}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(BONUS_GAME_LABELS) as BonusGameType[]).map((game) => (
          <button
            key={game}
            type="button"
            disabled={pending}
            onClick={() => onPick(game)}
            className="min-h-12 rounded-2xl bg-[#F7F5FC] px-2 text-sm font-bold text-[#3B1A8C] disabled:opacity-50"
          >
            {BONUS_GAME_LABELS[game]}
          </button>
        ))}
      </div>
    </div>
  );
}

function DebateFlow({
  optionA,
  optionB,
  people,
  votes,
  myVote,
  signed,
  userId,
  pending,
  namesFor,
  onVote,
  onDone,
  onSkip,
}: {
  optionA: string;
  optionB: string;
  people: { userId: string; name: string }[];
  votes: { userId: string; choice: "a" | "b" }[];
  myVote: "a" | "b" | null;
  signed: Set<string>;
  userId: string;
  pending: boolean;
  namesFor: (choice: "a" | "b") => string[];
  onVote: (choice: "a" | "b") => void;
  onDone: () => void;
  onSkip: (speakerId: string) => void;
}) {
  const voted = new Set(votes.map((vote) => vote.userId));
  const notVoted = people.filter((person) => !voted.has(person.userId)).map((person) => person.name);
  const allVoted = people.length > 0 && notVoted.length === 0;
  const choiceOf = (id: string) => votes.find((vote) => vote.userId === id)?.choice ?? null;
  const labelOf = (choice: "a" | "b" | null) => (choice === "a" ? optionA : choice === "b" ? optionB : "");

  if (!allVoted) {
    // Step 1: everyone votes. Results stay hidden until the whole room has voted.
    return (
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <VoteButton label={optionA} selected={myVote === "a"} disabled={pending} onClick={() => onVote("a")} />
          <VoteButton label={optionB} selected={myVote === "b"} disabled={pending} onClick={() => onVote("b")} />
        </div>
        <p className="text-sm font-semibold text-[#6B5F8A]">
          {voted.size} of {people.length} voted
          {notVoted.length > 0 ? ` · waiting for ${notVoted.join(", ")}` : ""}
        </p>
        {myVote ? (
          <p className="text-sm text-[#4A3F66]">You picked {labelOf(myVote)}. You can change it until everyone has voted.</p>
        ) : null}
      </div>
    );
  }

  // Step 2: round robin. One person explains at a time, in room order.
  const speaker = people.find((person) => !signed.has(person.userId)) ?? null;
  const isMe = speaker?.userId === userId;

  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <VoteTally label={optionA} names={namesFor("a")} />
        <VoteTally label={optionB} names={namesFor("b")} />
      </div>
      {speaker ? (
        <div className={`rounded-2xl p-4 ${isMe ? "bg-[#5B21B6] text-white" : "bg-[#F1ECFF] text-[#3B1A8C]"}`}>
          <p className="font-heading text-xl font-extrabold leading-tight">
            {isMe ? "Your turn" : `It's ${speaker.name}'s turn`}
          </p>
          <p className={`mt-1 text-base ${isMe ? "text-violet-100" : ""}`}>
            {isMe
              ? `Explain in Punjabi why you chose ${labelOf(choiceOf(userId))}.`
              : `${speaker.name} is explaining in Punjabi why they chose ${labelOf(choiceOf(speaker.userId))}.`}
          </p>
          {isMe ? (
            <button
              type="button"
              disabled={pending}
              onClick={onDone}
              className="mt-3 inline-flex h-14 w-full items-center justify-center rounded-[18px] bg-white text-base font-bold text-[#5B21B6] disabled:opacity-50"
            >
              {"I've finished explaining"}
            </button>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => onSkip(speaker.userId)}
              className="mt-2 text-sm font-bold underline disabled:opacity-50"
            >
              {`Skip ${speaker.name}`}
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm font-semibold text-[#6B5F8A]">{"Everyone's explained. Moving on…"}</p>
      )}
      <ol className="flex flex-wrap gap-2" aria-label="Speaking order">
        {people.map((person, index) => {
          const done = signed.has(person.userId);
          const current = speaker?.userId === person.userId;
          return (
            <li
              key={person.userId}
              className={`inline-flex h-9 items-center rounded-full px-3 text-sm font-bold ${
                current ? "bg-[#5B21B6] text-white" : done ? "bg-[#E4DFEE] text-[#6B5F8A] line-through" : "bg-[#F7F5FC] text-[#1F1640]"
              }`}
            >
              {index + 1}. {person.name}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function VoteTally({ label, names }: { label: string; names: string[] }) {
  return (
    <div className="col-span-2">
      <p className="text-sm font-bold text-[#1F1640]">
        {label} · {names.length}
      </p>
      {names.length > 0 ? <p className="text-sm text-[#6B5F8A]">{names.join(", ")}</p> : null}
    </div>
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
