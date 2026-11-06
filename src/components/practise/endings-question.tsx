"use client";

import { useRef, useState } from "react";
import { startsWithAttachedSign, type EndingCard, type EndingPart } from "@/lib/practise/endings-bank";
import type { EndingsPayload } from "@/lib/practise/types";

const STATE_COLOUR = { set: "#7F22FE", right: "#008236", wrong: "#CA3500" };

const LAST_LETTER = /[ਅ-ਹਖ਼-ਫ਼ੲ-ੴ][ਁ-ਃ਼-ੑੰੱ]*$/;

/** The letter a bindi, tippi or vowel sign sits on, taken from the text just before the gap. */
function letterBeforeGap(parts: EndingPart[], gap: number): string {
  const at = parts.findIndex((p) => "gap" in p && p.gap === gap);
  const before = at > 0 ? parts[at - 1] : null;
  if (!before || !("text" in before)) return "";
  return before.text.match(LAST_LETTER)?.[0] ?? "";
}

/**
 * A vowel sign, bindi or tippi must never sit in a different element (or colour) from the letter it
 * belongs to: iOS shapes each styled run on its own, so a lone sign shows a dotted circle.
 * When a filled gap starts with an attached sign, the letter before it moves into the gap's span,
 * so the coloured run is a whole syllable and the word still reads as one joined word.
 */
function borrowsLetter(parts: EndingPart[], i: number, picks: (string | null)[]): boolean {
  const part = parts[i];
  if (!part || !("gap" in part)) return false;
  const picked = picks[part.gap];
  const before = parts[i - 1];
  return !!picked && startsWithAttachedSign(picked) && !!before && "text" in before && LAST_LETTER.test(before.text);
}

function gapState(locked: boolean, picked: string | null, answer: EndingCard): keyof typeof STATE_COLOUR {
  if (!locked) return "set";
  return picked === answer.g ? "right" : "wrong";
}

/** Word and ending are one run of text, so the letters join up exactly as they would in the finished word. */
function Sentence({ data, picks, locked, onClear }: { data: EndingsPayload; picks: (string | null)[]; locked: boolean; onClear: (gap: number) => void }) {
  return (
    <p lang="pa" className="mt-5 text-center font-[family-name:var(--font-noto-gurmukhi)] text-[32px] font-bold leading-[60px] text-zinc-900">
      {data.parts.map((part, i) => {
        if ("text" in part) {
          const text = borrowsLetter(data.parts, i + 1, picks) ? part.text.replace(LAST_LETTER, "") : part.text;
          return <span key={i}>{text}</span>;
        }
        const picked = picks[part.gap];
        if (!picked) {
          return (
            <span
              key={i}
              data-gap={part.gap}
              aria-label="Empty gap"
              className="inline-block h-[0.88em] w-[1.5em] border-b-[3px] border-t-[3px] border-b-violet-400 border-t-zinc-900 bg-violet-50 align-[-0.26em]"
              style={{ borderBottomStyle: "dashed" }}
            />
          );
        }
        const colour = STATE_COLOUR[gapState(locked, picked, data.answers[part.gap])];
        return (
          // A plain inline span, never a button: a button breaks the word apart and strands a bindi or vowel sign.
          <span
            key={i}
            role={locked ? undefined : "button"}
            tabIndex={locked ? undefined : 0}
            data-gap={part.gap}
            aria-label={locked ? undefined : `Take back ${picked}`}
            onClick={locked ? undefined : () => onClear(part.gap)}
            onKeyDown={locked ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClear(part.gap); } }}
            className={locked ? undefined : "cursor-pointer"}
            style={{ color: colour, textDecoration: `underline wavy ${colour} 2px`, textUnderlineOffset: 7, textDecorationSkipInk: "none" }}
          >
            {borrowsLetter(data.parts, i, picks) ? letterBeforeGap(data.parts, part.gap) : null}
            {picked}
          </span>
        );
      })}
    </p>
  );
}

function RomanLine({ data, picks, locked }: { data: EndingsPayload; picks: (string | null)[]; locked: boolean }) {
  return (
    <p className="mt-1 text-center text-base font-semibold text-zinc-700">
      {data.romanParts.map((part, i) => {
        if ("text" in part) return <span key={i}>{part.text}</span>;
        const picked = picks[part.gap];
        if (!picked) return <span key={i} className="font-extrabold text-violet-700">___</span>;
        const card = data.cards.find((c) => c.g === picked);
        return (
          <span key={i} className="font-extrabold" style={{ color: STATE_COLOUR[gapState(locked, picked, data.answers[part.gap])] }}>
            {card?.r}
          </span>
        );
      })}
    </p>
  );
}

export function EndingsQuestion({ data, picks, locked, onPicks, onTap }: { data: EndingsPayload; picks: (string | null)[]; locked: boolean; onPicks: (next: (string | null)[]) => void; onTap: () => void }) {
  const single = data.answers.length === 1;
  const [drag, setDrag] = useState<{ card: EndingCard; x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const activeGap = () => {
    const empty = picks.findIndex((p) => p === null);
    return empty >= 0 ? empty : picks.length - 1;
  };
  const place = (card: EndingCard, gap: number) => {
    const next = [...picks];
    next[gap] = card.g;
    onPicks(next);
    onTap();
  };
  const clear = (gap: number) => {
    const next = [...picks];
    next[gap] = null;
    onPicks(next);
    onTap();
  };
  const dropGap = (x: number, y: number) => {
    const under = document.elementsFromPoint(x, y).find((el) => el instanceof HTMLElement && el.dataset.gap != null) as HTMLElement | undefined;
    return under ? Number(under.dataset.gap) : null;
  };
  const ghostLetter = letterBeforeGap(data.parts, locked ? 0 : activeGap());
  const compact = data.cards.length > 4;

  return (
    <div className="flex flex-1 flex-col">
      <Sentence data={data} picks={picks} locked={locked} onClear={clear} />
      <RomanLine data={data} picks={picks} locked={locked} />
      {!single && !locked ? <p className="mt-1 text-center text-[13px] font-bold text-violet-700">{data.answers.length} endings to fill</p> : null}
      <div className="mt-auto grid grid-cols-2 gap-2.5 pt-5">
        {data.cards.map((card) => {
          const usedHere = single && !locked && picks[0] === card.g;
          if (usedHere) return <div key={card.g} className={`rounded-[18px] border-2 border-dashed border-zinc-200 bg-zinc-50 ${compact ? "h-16" : "h-[84px]"}`} />;
          const isAnswer = data.answers.some((a) => a.g === card.g);
          const wasPicked = picks.includes(card.g);
          const tone = !locked
            ? "border-zinc-200 bg-white text-zinc-900 shadow-[0_3px_0_#E4E4E7]"
            : isAnswer
              ? "border-green-700 bg-green-50 text-zinc-900"
              : wasPicked
                ? "border-orange-700 bg-orange-50 text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-500";
          return (
            <button
              key={card.g}
              type="button"
              disabled={locked}
              className={`flex touch-none select-none flex-col items-center justify-center rounded-[18px] border-2 ${compact ? "h-16" : "h-[84px]"} ${tone}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                start.current = { x: e.clientX, y: e.clientY, moved: false };
              }}
              onPointerMove={(e) => {
                const s = start.current;
                if (!s) return;
                if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) > 8) s.moved = true;
                if (s.moved) setDrag({ card, x: e.clientX, y: e.clientY });
              }}
              onPointerUp={(e) => {
                const s = start.current;
                start.current = null;
                setDrag(null);
                if (!s) return;
                if (!s.moved) { place(card, activeGap()); return; }
                const gap = dropGap(e.clientX, e.clientY);
                if (gap != null) place(card, gap);
              }}
              onPointerCancel={() => { start.current = null; setDrag(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); place(card, activeGap()); } }}
            >
              <span lang="pa" className="font-[family-name:var(--font-noto-gurmukhi)] text-[26px] font-bold leading-tight">
                {/* One run of text: a separately coloured letter would strand the sign as ◌ਾ on iOS. */}
                {startsWithAttachedSign(card.g) ? ghostLetter + card.g : card.g}
              </span>
              <span className="text-[13px] font-semibold text-zinc-600">{card.r}</span>
            </button>
          );
        })}
      </div>
      {drag ? (
        <span
          aria-hidden="true"
          lang="pa"
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-violet-600 bg-white px-4 py-2 font-[family-name:var(--font-noto-gurmukhi)] text-[26px] font-bold text-zinc-900 shadow-lg"
          style={{ left: drag.x, top: drag.y }}
        >
          {startsWithAttachedSign(drag.card.g) ? ghostLetter + drag.card.g : drag.card.g}
        </span>
      ) : null}
    </div>
  );
}
