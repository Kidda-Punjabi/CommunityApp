"use client";

import { useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";

export type SwipeDirection = "left" | "right";

export type SwipeCardHandle = {
  /** Fly the card off as if swiped (used by the Confident / Not yet buttons). */
  fling: (direction: SwipeDirection) => void;
};

type SwipeCardProps = {
  ref?: Ref<SwipeCardHandle>;
  front: ReactNode;
  back: ReactNode;
  flipped: boolean;
  /** Cards like "Speak about" have no back: tapping does nothing. */
  canFlip?: boolean;
  onFlip: () => void;
  onSwiped: (direction: SwipeDirection) => void;
  leftStamp: string;
  rightStamp: string;
  disabled?: boolean;
  overlay?: ReactNode;
};

const SWIPE_DISTANCE = 96;
const FLING_MS = 230;

/**
 * A flashcard you can tap to flip and drag left / right to rate.
 * The card follows the finger, tilts, shows a stamp, then flies off; the parent
 * swaps in the next card (which rises from the stack via .flashcard-rise).
 */
export function SwipeCard({
  ref,
  front,
  back,
  flipped,
  canFlip = true,
  onFlip,
  onSwiped,
  leftStamp,
  rightStamp,
  disabled = false,
  overlay,
}: SwipeCardProps) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<SwipeDirection | null>(null);
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const moved = useRef(false);

  function fling(direction: SwipeDirection) {
    if (leaving || disabled) return;
    setLeaving(direction);
    setDragging(false);
    const width = typeof window === "undefined" ? 480 : window.innerWidth;
    setDx(direction === "right" ? width : -width);
    window.setTimeout(() => {
      onSwiped(direction);
      setLeaving(null);
      setDx(0);
    }, FLING_MS);
  }

  useImperativeHandle(ref, () => ({ fling }));

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled || leaving) return;
    start.current = { x: event.clientX, y: event.clientY, t: performance.now(), id: event.pointerId };
    moved.current = false;
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const s = start.current;
    if (!s || s.id !== event.pointerId) return;
    const deltaX = event.clientX - s.x;
    const deltaY = event.clientY - s.y;
    if (!moved.current && Math.abs(deltaX) > 6 && Math.abs(deltaX) > Math.abs(deltaY)) {
      moved.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (moved.current) setDx(deltaX);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s) return;
    if (!moved.current) {
      setDx(0);
      if (canFlip) onFlip();
      return;
    }
    const deltaX = event.clientX - s.x;
    const velocity = Math.abs(deltaX) / Math.max(1, performance.now() - s.t);
    if (Math.abs(deltaX) > SWIPE_DISTANCE || (Math.abs(deltaX) > 40 && velocity > 0.6)) {
      fling(deltaX > 0 ? "right" : "left");
    } else {
      setDx(0);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if ((event.key === "Enter" || event.key === " ") && canFlip) {
      event.preventDefault();
      onFlip();
    } else if (event.key === "ArrowRight") {
      fling("right");
    } else if (event.key === "ArrowLeft") {
      fling("left");
    }
  }

  const rotate = dx / 18;
  const stampStrength = Math.min(1, Math.abs(dx) / SWIPE_DISTANCE);
  const towardRight = dx > 0;

  return (
    <div className="relative h-full w-full select-none" style={{ perspective: 1200 }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={canFlip ? "Flashcard. Tap to flip, swipe right if confident, left if not yet." : "Flashcard. Swipe right when done, left to skip."}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setDx(0);
        }}
        onKeyDown={onKeyDown}
        className="absolute inset-0 cursor-grab touch-pan-y outline-none focus-visible:ring-4 focus-visible:ring-violet-300 active:cursor-grabbing"
        style={{
          transform: `translateX(${dx}px) rotate(${rotate}deg)`,
          transition: dragging ? "none" : `transform ${leaving ? FLING_MS : 260}ms cubic-bezier(.2,.8,.2,1)`,
          borderRadius: 28,
        }}
      >
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            transition: "transform 380ms cubic-bezier(.2,.8,.2,1)",
            transform: flipped ? "rotateY(180deg)" : "none",
          }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-[28px] bg-white shadow-[0_18px_40px_-18px_rgba(59,26,140,0.35)]"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
          >
            {front}
          </div>
          <div
            className="absolute inset-0 overflow-hidden rounded-[28px] bg-white shadow-[0_18px_40px_-18px_rgba(59,26,140,0.35)]"
            style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            {back}
          </div>
        </div>
        {dx !== 0 ? (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute top-7 rounded-xl border-[3px] px-3 py-1 font-heading text-xl font-extrabold tracking-wide ${
              towardRight
                ? "left-6 -rotate-12 border-teal-700 text-teal-700"
                : "right-6 rotate-12 border-orange-700 text-orange-700"
            }`}
            style={{ opacity: stampStrength }}
          >
            {towardRight ? rightStamp : leftStamp}
          </span>
        ) : null}
        {dx !== 0 ? (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 rounded-[28px] ring-[3px] ${towardRight ? "ring-teal-700" : "ring-orange-700"}`}
            style={{ opacity: stampStrength }}
          />
        ) : null}
      </div>
      {overlay}
    </div>
  );
}
