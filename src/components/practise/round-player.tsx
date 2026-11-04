"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPractiseAudio } from "@/app/dashboard/home/practise-actions";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { recordingExtensionForBlob, useAudioRecorder } from "@/lib/audio/use-audio-recorder";
import { usePractiseSound } from "@/lib/practise/sounds";
import type { RoundAnswer, RoundQuestion } from "@/lib/practise/types";

const SLOW_RATE = 0.55;

function similarity(a: string, b: string) {
  const clean = (s: string) => s.replace(/[\s?.,!।'"]/g, "");
  const x = clean(a), y = clean(b);
  if (!x || !y) return 0;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = row;
  }
  return 1 - prev[y.length] / Math.max(x.length, y.length);
}

function useQuestionAudio() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "failed">("idle");
  const [playingSlow, setPlayingSlow] = useState(false);
  const play = useCallback(async (key: string, slow: boolean) => {
    setState("loading");
    setPlayingSlow(slow);
    const url = await getPractiseAudio(key).catch(() => null);
    if (!url) return setState("failed");
    ref.current?.pause();
    const audio = new Audio(url);
    audio.playbackRate = slow ? SLOW_RATE : 1;
    (audio as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    ref.current = audio;
    audio.onended = () => setState("idle");
    audio.onerror = () => setState("failed");
    setState("playing");
    await audio.play().catch(() => setState("idle"));
  }, []);
  useEffect(() => () => ref.current?.pause(), []);
  return { play, state, playingSlow };
}

function Tortoise({ size }: { size: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 15.5a7.5 7.5 0 0 1 15 0z" />
      <path d="M7.5 15.5 9.5 9.2M14.5 15.5l-2-6.3M3.8 13h14.4" />
      <path d="M18.3 13.5h1.7a2.3 2.3 0 0 0 0-4.6c-1.1 0-1.9.7-2.2 1.6" />
      <path d="M6 15.5v2.3M16 15.5v2.3" />
    </svg>
  );
}

export function AudioButton({ audioKey, large, noSlow }: { audioKey: string; large?: boolean; noSlow?: boolean }) {
  const { play, state, playingSlow } = useQuestionAudio();
  const busyNormal = state === "playing" && !playingSlow;
  const busySlow = state === "playing" && playingSlow;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => void play(audioKey, false)} aria-label="Play the Punjabi" className={`flex items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-900/25 ${large ? "h-24 w-24" : "h-12 w-12"} ${busyNormal ? "animate-pulse" : ""}`}>
          <svg aria-hidden="true" width={large ? 40 : 22} height={large ? 40 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
        </button>
        {noSlow ? null : (
          <button type="button" onClick={() => void play(audioKey, true)} aria-label="Play slowly" className={`flex items-center justify-center rounded-full border-2 border-violet-200 bg-white text-violet-700 ${large ? "h-16 w-16" : "h-12 w-12"} ${busySlow ? "animate-pulse" : ""}`}>
            <Tortoise size={large ? 34 : 24} />
          </button>
        )}
      </div>
      {state === "loading" ? <span className="text-xs font-semibold text-zinc-500">Loading audio…</span> : null}
      {state === "failed" ? <span className="text-xs font-semibold text-orange-700">Audio didn&apos;t load. Tap to try again.</span> : null}
    </div>
  );
}

function Option({ label, sub, state, onClick }: { label: string; sub?: string; state: "" | "right" | "wrong"; onClick: () => void }) {
  const look = state === "right" ? "border-green-700 bg-green-50" : state === "wrong" ? "border-orange-700 bg-orange-50" : "border-zinc-200 bg-white active:bg-violet-50";
  return (
    <button type="button" onClick={onClick} className={`flex min-h-[58px] w-full flex-col justify-center rounded-2xl border-2 px-4 py-2 text-left ${look}`}>
      <span className="text-[17px] font-bold text-zinc-900">{label}</span>
      {sub ? <span className="text-[13px] font-semibold text-zinc-600">{sub}</span> : null}
    </button>
  );
}

/** Press and hold to record, let go to check. Works in every browser that has a microphone. */
function PushToTalk({ q, onMatch, onMiss }: { q: RoundQuestion; onMatch: () => void; onMiss: (note: string) => void }) {
  const recorder = useAudioRecorder({ maxDurationSeconds: 20 });
  const pressed = useRef(false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const { blob, discardRecording, error, startRecording, state, stopRecording } = recorder;
  const recording = state === "recording";

  const press = async () => {
    pressed.current = true;
    setNote(null);
    await startRecording();
    if (!pressed.current) stopRecording();
  };
  const release = () => {
    if (!pressed.current) return;
    pressed.current = false;
    stopRecording();
  };

  const check = async (clip: Blob) => {
    discardRecording();
    if (clip.size < 3000) { setNote("Keep holding the button while you talk."); return; }
    setChecking(true);
    const form = new FormData();
    form.append("audio", clip, `speech.${recordingExtensionForBlob(clip)}`);
    form.append("target_romanised", q.answer.romanised);
    form.append("target_punjabi", q.answer.gurmukhi);
    try {
      const response = await fetch("/api/practise/transcribe", { method: "POST", body: form });
      const data = (await response.json()) as { transcript?: string; error?: string };
      if (data.error || data.transcript == null) onMiss(data.error ?? "We couldn't check that one.");
      else if (similarity(data.transcript, q.answer.gurmukhi) >= 0.6) onMatch();
      else onMiss(data.transcript.trim() ? `We heard: ${data.transcript.trim()}` : "We didn't catch that.");
    } catch {
      onMiss("We couldn't check that one.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (blob) void check(blob);
  }, [blob]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={checking}
        aria-label="Press and hold to talk, let go when you're done"
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); void press(); }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); void press(); } }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") release(); }}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex h-28 w-28 touch-none select-none items-center justify-center rounded-full text-white shadow-lg transition-transform disabled:opacity-60 ${recording ? "scale-110 bg-orange-700" : "bg-violet-600"}`}
      >
        <svg aria-hidden="true" width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></svg>
      </button>
      <p className={`text-center text-[15px] font-extrabold ${recording ? "text-orange-700" : "text-zinc-700"}`}>
        {checking ? "Checking…" : recording ? "Listening. Let go when you're done." : "Press and hold to talk. Let go when you're done."}
      </p>
      {note || error ? <p className="text-center text-sm font-semibold text-orange-700">{note ?? error}</p> : null}
    </div>
  );
}

export function applySessionOff(list: RoundQuestion[], off: { speaking: boolean; listening: boolean }) {
  return list.flatMap((q) => {
    if ((off.speaking && q.type === "say") || (off.listening && q.type === "listen")) return q.fallback ? [q.fallback] : [];
    return [q];
  });
}

export function RoundPlayer({
  questions,
  onFinish,
  onLeave,
  off,
  onTurnOff,
}: {
  questions: RoundQuestion[];
  onFinish: (answers: RoundAnswer[]) => void;
  onLeave: () => void;
  off: { speaking: boolean; listening: boolean };
  onTurnOff: (kind: "speaking" | "listening") => void;
}) {
  const sound = usePractiseSound();
  const { soundEnabled, setSoundEnabled } = useAudioManager();
  const [queue, setQueue] = useState(() => applySessionOff(questions, off));
  const startSize = useRef(queue.length);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<RoundAnswer[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const finished = useRef(false);
  const q = queue[index];

  useEffect(() => {
    if (!q && !finished.current) {
      finished.current = true;
      if (answers.length) onFinish(answers);
      else onLeave();
    }
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!q) return null;

  const finish = (list: RoundAnswer[]) => {
    if (finished.current) return;
    finished.current = true;
    onFinish(list);
  };

  const judge = (correct: boolean, pick?: string) => {
    setPicked(pick ?? null);
    setVerdict(correct);
    const nextRun = correct ? run + 1 : 0;
    setRun(nextRun);
    sound(correct ? (nextRun > 0 && nextRun % 3 === 0 ? "combo" : "correct") : "wrong");
    setAnswers((a) => [...a, { itemId: q.itemId, skill: q.skill, correct, uncounted: q.uncounted }]);
    // A miss comes back at the end of the round, so it sticks.
    if (!correct && queue.length < startSize.current + 5) setQueue((list) => [...list, q]);
  };

  const clearQuestion = () => {
    setPicked(null); setVerdict(null); setBuilt([]); setRevealed(false); setMicNote(null);
  };

  const next = () => {
    clearQuestion();
    if (index + 1 >= queue.length) { finish(answers); return; }
    setIndex(index + 1);
  };

  /** Off for the rest of this session. Later rounds skip it too, and the round keeps its length. */
  const turnOff = (kind: "speaking" | "listening") => {
    onTurnOff(kind);
    clearQuestion();
    const flags = { speaking: kind === "speaking", listening: kind === "listening" };
    setQueue([...queue.slice(0, index), ...applySessionOff(queue.slice(index), flags)]);
  };

  const tiles = q.tiles ?? [];
  const pct = Math.round((index / queue.length) * 100);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] w-full max-w-md flex-col px-4 pb-4 pt-2 lg:relative lg:left-1/2 lg:w-[640px] lg:max-w-none lg:-translate-x-1/2 lg:pt-8">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onLeave} aria-label="Leave round" className="flex h-11 w-11 items-center justify-center text-zinc-900">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} /></div>
        <span className="text-[13px] font-extrabold text-zinc-600">{index + 1}/{queue.length}</span>
        <button type="button" onClick={() => void setSoundEnabled(!soundEnabled)} aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"} className="flex h-11 w-11 items-center justify-center text-zinc-600">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" />{soundEnabled ? <path d="M15.5 8.5a5 5 0 0 1 0 7" /> : <path d="m16 9 5 6M21 9l-5 6" />}</svg>
        </button>
      </div>

      <p className="mt-3 text-[13px] font-bold text-violet-700">{q.heading}</p>

      {q.type === "listen" ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          <AudioButton key={index} audioKey={q.audioKey!} large />
          <p className="text-[15px] font-semibold text-zinc-700">{q.prompt}</p>
          {verdict === null ? <button type="button" onClick={() => turnOff("listening")} className="min-h-11 text-sm font-extrabold text-violet-700">I can&apos;t listen right now</button> : null}
        </div>
      ) : (
        <h1 lang={q.promptIsGurmukhi ? "pa" : undefined} className={`mt-1 font-bold tracking-tight text-zinc-900 ${q.promptIsGurmukhi ? "text-center text-6xl" : "text-[27px] leading-tight"}`}>{q.prompt}</h1>
      )}
      {q.promptIsGurmukhi ? <p className="mt-2 text-center text-base font-semibold text-zinc-700">{q.answer.romanised}</p> : null}

      {q.options ? (
        <div className="mt-5 flex flex-col gap-2.5">
          {q.options.map((o) => (
            <Option key={o.id} label={o.label} sub={o.sub}
              state={verdict === null ? "" : o.id === q.answerId ? "right" : o.id === picked ? "wrong" : ""}
              onClick={() => { if (verdict === null) judge(o.id === q.answerId, o.id); }} />
          ))}
        </div>
      ) : null}

      {q.type === "tiles" ? (
        <div className="mt-5">
          <div className="flex min-h-[64px] flex-wrap content-start gap-2 border-b-2 border-zinc-200 pb-3">
            {built.map((t) => (
              <button key={t} type="button" onClick={() => { if (verdict === null) { sound("tap"); setBuilt(built.filter((b) => b !== t)); } }} className="min-h-11 rounded-xl border-2 border-violet-300 bg-violet-50 px-3 text-base font-bold text-zinc-900">{tiles[t]}</button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tiles.map((t, i) => (
              <button key={i} type="button" disabled={built.includes(i)} onClick={() => { sound("tap"); setBuilt([...built, i]); }} className={`min-h-11 rounded-xl border-2 px-3 text-base font-bold ${built.includes(i) ? "border-zinc-100 bg-zinc-100 text-transparent" : "border-zinc-200 bg-white text-zinc-900"}`}>{t}</button>
            ))}
          </div>
        </div>
      ) : null}

      {q.type === "say" && verdict === null ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          {q.selfRateOnly && q.audioKey ? <AudioButton audioKey={q.audioKey} /> : null}
          {!q.selfRateOnly ? (
            <PushToTalk key={`${index}-${revealed}`} q={q} onMatch={() => judge(true)} onMiss={(note) => { setMicNote(note); setRevealed(true); }} />
          ) : null}
          {micNote ? <p lang="pa" className="text-center text-sm font-semibold text-orange-700">{micNote}</p> : null}
          {revealed || q.selfRateOnly ? (
            <>
              {!q.selfRateOnly ? (
                <div className="flex w-full items-center gap-3 rounded-2xl bg-violet-50 p-4">
                  <div className="flex-1"><p lang="pa" className="text-xl font-bold text-zinc-900">{q.answer.gurmukhi}</p><p className="text-sm font-semibold text-zinc-700">{q.answer.romanised}</p></div>
                  {q.audioKey ? <AudioButton audioKey={q.audioKey} /> : null}
                </div>
              ) : null}
              <div className="grid w-full grid-cols-2 gap-2">
                <button type="button" onClick={() => judge(false)} className="min-h-14 rounded-2xl border-2 border-zinc-200 bg-white font-bold text-zinc-900">Not yet</button>
                <button type="button" onClick={() => judge(true)} className="min-h-14 rounded-2xl bg-violet-600 font-bold text-white">I said it</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setRevealed(true)} className="min-h-11 text-sm font-extrabold text-violet-700">Show the answer</button>
          )}
          <button type="button" onClick={() => turnOff("speaking")} className="min-h-11 text-sm font-extrabold text-violet-700">I can&apos;t speak right now</button>
        </div>
      ) : null}

      <div className="flex-1" />

      {q.type === "tiles" && verdict === null ? (
        <button type="button" disabled={built.length !== tiles.length}
          onClick={() => judge(built.map((i) => tiles[i]).join(" ") === q.answer.romanised.trim().split(/\s+/).join(" "))}
          className="mt-4 h-14 rounded-2xl bg-violet-600 text-lg font-extrabold text-white disabled:bg-zinc-200 disabled:text-zinc-500">Check</button>
      ) : null}

      {verdict !== null ? (
        <div className={`mt-4 rounded-3xl p-4 ${verdict ? "bg-green-50" : "bg-orange-50"}`}>
          <p className={`text-[22px] font-extrabold ${verdict ? "text-green-800" : "text-orange-800"}`}>{verdict ? "Sahi!" : "Not quite"}</p>
          <p lang="pa" className="mt-1 text-lg font-bold text-zinc-900">{q.answer.gurmukhi}</p>
          <p className="text-sm font-semibold text-zinc-700">{[q.answer.romanised, q.answer.english].filter(Boolean).join(" · ")}</p>
          {!verdict ? <p className="mt-1 text-[13px] font-semibold text-zinc-600">This one comes back before the round ends.</p> : null}
          <button type="button" onClick={next} className={`mt-3 h-14 w-full rounded-2xl text-lg font-extrabold text-white ${verdict ? "bg-green-700" : "bg-orange-700"}`}>Next</button>
        </div>
      ) : null}
    </div>
  );
}
