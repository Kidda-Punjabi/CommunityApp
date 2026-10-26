"use client";

import { castDebateVote, joinGroupGame, markActivityDone, openBonusGame, openPointRace } from "@/app/dashboard/community/breakout-actions";
import { GROUP_GAME_LABELS } from "@/lib/game-rooms/constants";
import type { GroupGameType } from "@/lib/game-rooms/types";
import { CommunityLiveSync } from "@/components/community/room-refresh";
import type { MemberRoomView } from "@/lib/community/breakout";
import { bandFillVar, bandInkVar, bandLabel } from "@/lib/community/levels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
      {view.phase === "main" ? (
        <section className="rounded-[24px] bg-[#5B21B6] p-5 text-white">
          <p className="font-heading text-2xl font-extrabold leading-tight">{"Back in the main room"}</p>
          <p className="mt-2 text-base text-violet-100">
            {view.groupGame ? "Everyone's playing one game together." : "Arsh is running the last part with everyone together."}
          </p>
          {view.groupGame ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void (async () => {
                  setPending(true);
                  const result = await joinGroupGame(view.occurrenceId);
                  setPending(false);
                  if ("href" in result && result.href) router.push(result.href);
                  else if ("error" in result && result.error) setError(result.error);
                })()
              }
              className="mt-4 flex h-14 w-full items-center justify-center rounded-[18px] bg-white px-4 text-base font-extrabold text-[#5B21B6] disabled:opacity-50"
            >
              Join {GROUP_GAME_LABELS[view.groupGame.gameType as GroupGameType] ?? "the game"} · code {view.groupGame.joinCode}
            </button>
          ) : null}
          <p className="mt-3 text-sm text-violet-100">Stay on the call. The feedback form opens when Arsh ends the session.</p>
        </section>
      ) : view.phase === "waiting" ? (
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
              onVote={(choice) =>
                run(async () => {
                  const voted = await castDebateVote(active.id, choice);
                  if ("error" in voted && voted.error) return voted;
                  return markActivityDone(active.id);
                })
              }
              onDone={() => run(() => markActivityDone(active.id))}
              onRace={() => run(() => openPointRace(active.id))}
              meId={userId}
              onBonus={(gameType) => run(() => openBonusGame(active.id, gameType))}
            />
          ) : (
            <section className="rounded-[24px] bg-white p-4">
              <p className="font-heading text-xl font-extrabold text-[#1F1640]">{"Your room is done."}</p>
              <p className="mt-1 text-sm text-[#6B5F8A]">Arsh can see you&apos;ve finished. Stay in the call and she&apos;ll bring everyone back.</p>
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
  myVote,
  votes,
  pending,
  onVote,
  onDone,
  onRace,
  meId,
  onBonus,
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
  onRace: () => void;
  meId: string;
  onBonus: (gameType?: GroupGameType) => void;
}) {
  const payload = activity.payload;
  // The app picks the bonus-game host: the first person in the room by name.
  const host = [...people].sort((a, b) => a.name.localeCompare(b.name))[0] ?? null;
  const iAmHost = host?.userId === meId;
  const bonusGame = typeof payload.joinCode === "string" && payload.joinCode ? (payload.gameType as GroupGameType | null) : null;
  const [pickAnyway, setPickAnyway] = useState(false);
  const isBonus = activity.kind === "bonus";
  const instruction =
    activity.kind === "warmup_debate"
      ? "Vote, then each person says why in Punjabi."
      : typeof payload.instruction === "string"
        ? payload.instruction
        : "";
  const waiting = people.filter((person) => !signed.has(person.userId)).map((person) => person.name);
  const doneCount = people.length - waiting.length;
  const namesFor = (choice: "a" | "b") =>
    votes
      .filter((vote) => vote.choice === choice)
      .map((vote) => people.find((person) => person.userId === vote.userId)?.name ?? "Member");
  const prompts = Array.isArray(payload.prompts) ? (payload.prompts as { front?: string; back?: string }[]) : [];
  const [promptIndex, setPromptIndex] = useState(0);
  const prompt = prompts[promptIndex];
  const heading = activity.kind === "warmup_debate" && typeof payload.prompt === "string" ? payload.prompt : activity.title;

  // The one action for this activity. Finishing it in the app signs the member off on its own.
  let action: { label: string; href?: string; onClick?: () => void } | null = null;
  if (activity.kind === "flashcards" && payload.lessonId && payload.deckId) {
    action = { label: "Start flashcards", href: activityHref(`/dashboard/practice/flashcards/${payload.lessonId}/${payload.deckId}/study`, activity.id) };
  } else if (activity.kind === "quiz" && payload.quizId) {
    action = { label: "Start quiz", href: activityHref(`/dashboard/practice/quiz/${payload.quizId}`, activity.id) };
  } else if (activity.kind === "point_race") {
    action = { label: payload.joinCode ? `Join game ${payload.joinCode}` : "Start Point Race", onClick: onRace };
  } else if (activity.kind === "speak_it") {
    const lessonQuery = typeof payload.lessonId === "string" ? `?lessonId=${encodeURIComponent(payload.lessonId)}` : "";
    action = { label: "Start Speak It", href: activityHref(`/dashboard/games/speaking-practice${lessonQuery}`, activity.id) };
  } else if (activity.kind === "speaking_prompts") {
    // Spoken out loud, so there is nothing for the app to measure: the member says when the room is done.
    action = { label: "We've done this", onClick: onDone };
  } else if (isBonus && bonusGame) {
    action = {
      label: `${iAmHost ? "Open" : "Join"} ${GROUP_GAME_LABELS[bonusGame] ?? "game"} · code ${String(payload.joinCode)}`,
      onClick: () => onBonus(),
    };
  }

  return (
    <section className="rounded-[24px] bg-white p-4 text-[#1F1640]">
      <p className="text-xs font-bold uppercase tracking-wide text-[#6B5F8A]">
        {activity.position + 1} of {total}
      </p>
      <h2 className="mt-1 font-heading text-2xl font-extrabold">{heading}</h2>
      {typeof payload.romanised === "string" && payload.romanised ? (
        <p className="mt-1 text-sm text-[#6B5F8A]">{payload.romanised}</p>
      ) : null}
      {!iSigned || isBonus ? <p className="mt-2 text-base">{instruction}</p> : null}

      {activity.kind === "warmup_debate" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {!iSigned ? (
            <>
              <VoteButton label={String(payload.optionA ?? "A")} selected={myVote === "a"} disabled={pending} onClick={() => onVote("a")} />
              <VoteButton label={String(payload.optionB ?? "B")} selected={myVote === "b"} disabled={pending} onClick={() => onVote("b")} />
            </>
          ) : null}
          <VoteTally label={String(payload.optionA ?? "A")} names={namesFor("a")} />
          <VoteTally label={String(payload.optionB ?? "B")} names={namesFor("b")} />
        </div>
      ) : null}

      {activity.kind === "speaking_prompts" && prompt && !iSigned ? (
        <div className="mt-4 rounded-2xl bg-[#F7F5FC] p-3">
          <p className="text-lg font-bold">{prompt.front}</p>
          <p className="mt-2 text-base text-[#5B21B6]">{prompt.back}</p>
          {prompts.length > 1 ? (
            <button
              type="button"
              className="mt-3 min-h-11 text-sm font-bold text-[#5B21B6]"
              onClick={() => setPromptIndex((index) => (index + 1) % prompts.length)}
            >
              Next prompt
            </button>
          ) : null}
        </div>
      ) : null}

      {isBonus && !bonusGame ? (
        iAmHost || pickAnyway ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-bold text-[#6B5F8A]">
              {iAmHost ? "You're the host. Pick the game for your room:" : "Pick the game for your room:"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {BONUS_CHOICES.map((game) => (
                <button
                  key={game}
                  type="button"
                  disabled={pending}
                  onClick={() => onBonus(game)}
                  className="min-h-14 rounded-2xl bg-[#F7F5FC] px-3 text-base font-bold text-[#1F1640] disabled:opacity-40"
                >
                  {GROUP_GAME_LABELS[game]}
                </button>
              ))}
            </div>
            <p className="text-xs text-[#6B5F8A]">The game uses this week&apos;s topic. Everyone else gets a code to join.</p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-[#F7F5FC] p-4">
            <p className="text-base font-bold">Waiting for {host?.name ?? "the host"} to pick the game.</p>
            <button type="button" onClick={() => setPickAnyway(true)} className="mt-2 min-h-11 text-sm font-bold text-[#5B21B6]">
              Pick the game instead
            </button>
          </div>
        )
      ) : null}

      {iSigned && !isBonus ? (
        <div className="mt-4 rounded-2xl bg-[#EAF6EE] p-4 text-[#14532D]">
          <p className="font-heading text-xl font-extrabold">{"You're done."}</p>
          <p className="mt-1 text-base">
            {waiting.length === 0 ? "Everyone's done. Moving on…" : `Waiting for ${waiting.join(", ")}.`}
          </p>
        </div>
      ) : (
        <>
          {action ? (
            action.href ? (
              <a href={action.href} className={primaryClass}>
                {action.label}
              </a>
            ) : (
              <button type="button" disabled={pending} onClick={action.onClick} className={primaryClass}>
                {action.label}
              </button>
            )
          ) : null}
          {!isBonus ? (
            <p className="mt-3 text-sm font-semibold text-[#6B5F8A]">
              {doneCount} of {people.length} done
              {activity.kind === "warmup_debate" ? " · voting counts as done" : ""}
            </p>
          ) : (
            <p className="mt-3 text-sm font-semibold text-[#6B5F8A]">Keep going until Arsh brings everyone back.</p>
          )}
        </>
      )}
    </section>
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

const BONUS_CHOICES: GroupGameType[] = ["point_race", "buzz_in", "jeopardy", "sentence_builder_group"];

const primaryClass =
  "mt-4 flex h-14 w-full items-center justify-center rounded-[18px] bg-[#5B21B6] px-4 text-base font-bold text-white disabled:opacity-40";
