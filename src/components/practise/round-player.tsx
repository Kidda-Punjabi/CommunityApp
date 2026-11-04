"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPractiseAudio } from "@/app/dashboard/home/practise-actions";
import { useAudioManager } from "@/lib/audio/audio-manager";
import { startPunjabiRecognitionSession } from "@/lib/speech/punjabi-recognition-session";
import { isSpeechRecognitionSupported } from "@/lib/speech/speech-recognition";
import { usePractiseSound } from "@/lib/practise/sounds";
import type { RoundAnswer, RoundQuestion } from "@/lib/practise/types";

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

export function useQuestionAudio() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "failed">("idle");
  const play = useCallback(async (key: string) => {
    setState("loading");
    const url = await getPractiseAudio(key).catch(() => null);
    if (!url) return setState("failed");
    ref.current?.pause();
    const audio = new Audio(url);
    ref.current = audio;
    audio.onended = () => setState("idle");
    audio.onerror = () => setState("failed");
    setState("playing");
    await audio.play().catch(() => setState("idle"));
  }, []);
  useEffect(() => () => ref.current?.pause(), []);
  return { play, state };
}

export function AudioButton({ audioKey, large }: { audioKey: string; large?: boolean }) {
  const { play, state } = useQuestionAudio();
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void play(audioKey)}
        aria-label="Play the Punjabi"
        className={`flex items-center justify-center rounded-full bg-violet-600 text-white shadow-lg shadow-violet-900/25 ${large ? "h-24 w-24" : "h-12 w-12"} ${state === "playing" ? "animate-pulse" : ""}`}
      >
        <svg aria-hidden="true" width={large ? 40 : 22} height={large ? 40 : 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
      </button>
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

export function RoundPlayer({
  questions,
  onFinish,
  onLeave,
}: {
  questions: RoundQuestion[];
  onFinish: (answers: RoundAnswer[]) => void;
  onLeave: () => void;
}) {
  const sound = usePractiseSound();
  const { soundEnabled, setSoundEnabled } = useAudioManager();
  const [queue, setQueue] = useState(questions);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<RoundAnswer[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const [built, setBuilt] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [run, setRun] = useState(0);
  const session = useRef<{ stop: () => void } | null>(null);
  const finished = useRef(false);
  const q = queue[index];

  useEffect(() => () => session.current?.stop(), []);
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
    setAnswers((a) => [...a, { itemId: q.itemId, skill: q.skill, correct }]);
    // A miss comes back once at the end of the round, like a second chance.
    if (!correct && queue.length < questions.length + 3) setQueue((list) => [...list, q]);
  };

  const clearQuestion = () => {
    setPicked(null); setVerdict(null); setBuilt([]); setRevealed(false); setMicNote(null); setListening(false);
  };

  const next = () => {
    clearQuestion();
    if (index + 1 >= queue.length) { finish(answers); return; }
    setIndex(index + 1);
  };

  /** Drop this question and every later question of the same kind. The other kind stays. */
  const skipKind = (kind: "listen" | "say") => {
    session.current?.stop();
    const kept = queue.filter((item, i) => i < index || (i > index && item.type !== kind));
    clearQuestion();
    if (index >= kept.length) {
      setQueue(kept);
      if (answers.length) finish(answers);
      else onLeave();
      return;
    }
    setQueue(kept);
  };

  const listen = () => {
    if (listening) { session.current?.stop(); return; }
    setMicNote(null);
    session.current = startPunjabiRecognitionSession({
      onListeningChange: setListening,
      onError: (m) => { setMicNote(m); setRevealed(true); },
      onTranscript: (t) => {
        session.current?.stop();
        setRevealed(true);
        if (similarity(t, q.answer.gurmukhi) >= 0.6) judge(true);
        else setMicNote("That wasn't quite picked up. Compare it below, then rate yourself.");
      },
    });
  };

  const tiles = q.tiles ?? [];
  const canMic = q.type === "say" && !q.selfRateOnly && isSpeechRecognitionSupported();
  const pct = Math.round((index / queue.length) * 100);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] w-full max-w-md flex-col px-4 pb-4 pt-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onLeave} aria-label="Leave round" className="flex h-11 w-11 items-center justify-center text-zinc-900">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-violet-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} /></div>
        <button type="button" onClick={() => void setSoundEnabled(!soundEnabled)} aria-label={soundEnabled ? "Turn sound off" : "Turn sound on"} className="flex h-11 w-11 items-center justify-center text-zinc-600">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" />{soundEnabled ? <path d="M15.5 8.5a5 5 0 0 1 0 7" /> : <path d="m16 9 5 6M21 9l-5 6" />}</svg>
        </button>
      </div>

      <p className="mt-3 text-[13px] font-bold text-violet-700">{q.heading}</p>

      {q.type === "listen" ? (
        <div className="mt-4 flex flex-col items-center gap-2">
          <AudioButton key={`${index}`} audioKey={q.audioKey!} large />
          <p className="text-[15px] font-semibold text-zinc-700">{q.prompt}</p>
          {verdict === null ? (
            <button type="button" onClick={() => skipKind("listen")} className="min-h-11 text-sm font-extrabold text-violet-700">I can&apos;t listen right now</button>
          ) : null}
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
          {canMic ? (
            <button type="button" onClick={listen} aria-label={listening ? "Stop listening" : "Tap and say it"} className={`flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg ${listening ? "animate-pulse bg-orange-700" : "bg-violet-600"}`}>
              <svg aria-hidden="true" width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></svg>
            </button>
          ) : null}
          {micNote ? <p className="text-center text-sm font-semibold text-orange-700">{micNote}</p> : null}
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
            <button type="button" onClick={() => setRevealed(true)} className="min-h-11 text-sm font-extrabold text-violet-700">Say it out loud, then show the answer</button>
          )}
          {verdict === null ? (
            <button type="button" onClick={() => skipKind("say")} className="min-h-11 text-sm font-extrabold text-violet-700">I can&apos;t speak right now</button>
          ) : null}
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
