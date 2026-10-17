"use client";

import { checkInByCode, submitCheckIn } from "@/app/dashboard/community/actions";
import { takeCheckinChars } from "@/lib/community/checkin-code";
import type { CheckInSuccess } from "@/lib/community/check-in-types";
import { levelFillVar } from "@/lib/community/levels";
import { isNativeApp } from "@/lib/native/platform";
import { notifyXpEarned } from "@/lib/points/notify-points-earned";
import { NavLink } from "@/components/ui/nav-link";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const JOIN_RETURN_KEY = "kidda-checkin-after-join";

function SuccessView({ result }: { result: CheckInSuccess }) {
  return (
    <div data-testid="check-in-success" className="flex flex-col gap-3">
      <h2 className="font-heading text-2xl font-extrabold leading-tight text-[#1F1640]">
        {result.already ? "You're already checked in" : `You're checked in to ${result.sessionName}`}
      </h2>
      {result.already ? <p className="text-sm font-semibold text-[#6B5F8A]">{result.sessionName}</p> : null}
      <p className="text-base font-semibold text-[#1F1640]">
        {result.countsForStreak ? `${result.streak}-week streak` : "Bonus session, nice one"}
      </p>
      {result.others.length > 0 ? (
        <div className="flex gap-2 overflow-hidden">
          {result.others.slice(0, 6).map((mate) => (
            <span
              key={mate.id}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F7F5FC] text-sm font-bold text-[#1F1640]"
              style={mate.level == null ? undefined : { boxShadow: `0 0 0 3px ${levelFillVar(mate.level)}` }}
              title={mate.name}
            >
              {mate.name.slice(0, 1)}
            </span>
          ))}
        </div>
      ) : null}
      {result.meetUrl ? (
        <a
          href={result.meetUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-14 items-center justify-center rounded-[18px] bg-[#FDE68A] text-sm font-bold text-[#3B1A8C]"
        >
          Join the call
        </a>
      ) : null}
    </div>
  );
}

export function CheckInPanel({ occurrenceId, onSuccess }: { occurrenceId?: string; onSuccess?: () => void }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState<CheckInSuccess | null>(null);
  const router = useRouter();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const busy = useRef(false);

  async function submit(next: string[]) {
    const code = next.join("");
    if (code.length < 4 || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    const result = occurrenceId ? await submitCheckIn(occurrenceId, code) : await checkInByCode(code);
    busy.current = false;
    setPending(false);
    if ("error" in result && result.error) {
      setError(result.error);
      setDigits(["", "", "", ""]);
      refs.current[0]?.focus();
      return;
    }
    if ("ok" in result && result.ok) {
      if (result.xpAwarded > 0) notifyXpEarned(result.xpAwarded);
      setSuccess(result);
      onSuccess?.();
      router.refresh();
    }
  }

  function fill(raw: string) {
    const chars = takeCheckinChars(raw);
    if (!chars) return;
    const next = ["", "", "", ""];
    [...chars].forEach((char, index) => {
      next[index] = char;
    });
    setDigits(next);
    setError(null);
    if (chars.length >= 4) void submit(next);
    else refs.current[chars.length]?.focus();
  }

  if (success) return <SuccessView result={success} />;

  return (
    <div>
      <p className="text-base font-semibold text-[#1F1640]">Enter the code Arsh shows on screen</p>
      <div className="mt-4 grid grid-cols-4 gap-2" onPaste={(event) => {
        const text = event.clipboardData.getData("text");
        if (!takeCheckinChars(text)) return;
        event.preventDefault();
        fill(text);
      }}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            value={digit}
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={4}
            aria-label={`Code character ${index + 1}`}
            disabled={pending}
            className="h-16 w-full min-w-0 rounded-[18px] border border-[#E4DFEE] bg-[#F7F5FC] text-center text-3xl font-extrabold uppercase text-[#1F1640] disabled:opacity-60"
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (!takeCheckinChars(text)) return;
              event.preventDefault();
              fill(text);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index] && index > 0) {
                const next = [...digits];
                next[index - 1] = "";
                setDigits(next);
                refs.current[index - 1]?.focus();
              }
            }}
            onChange={(event) => {
              const chars = takeCheckinChars(event.target.value);
              if (chars.length > 1) {
                fill(chars);
                return;
              }
              const next = [...digits];
              next[index] = chars;
              setDigits(next);
              setError(null);
              if (chars && index < 3) refs.current[index + 1]?.focus();
              if (next.every(Boolean)) void submit(next);
            }}
          />
        ))}
      </div>
      {error ? <p className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

export function CheckInSheet({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const first = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const input = first.current?.querySelector("input");
    if (input instanceof HTMLInputElement) input.focus();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-end bg-[#1F1640]/40" style={{ zIndex: 80 }} role="dialog" aria-modal="true" aria-label="Check in">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        ref={first}
        data-testid="check-in-sheet"
        className="relative max-h-[100dvh] w-full overflow-hidden rounded-t-[28px] bg-white px-5 pt-4 pb-[calc(var(--kidda-nav-clearance)+0.75rem)]"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wide text-[#6B5F8A]">Check in</p>
          <button type="button" className="text-sm font-bold text-[#5B21B6]" onClick={onClose}>
            Close
          </button>
        </div>
        <CheckInPanel onSuccess={onSuccess} />
      </div>
    </div>,
    document.body
  );
}

export function SessionCheckInButtons({
  meetUrl,
  canJoin,
  anyLive,
  returnToCheckIn,
}: {
  meetUrl: string | null;
  canJoin: boolean;
  anyLive: boolean;
  returnToCheckIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [stillNeeded, setStillNeeded] = useState(returnToCheckIn);
  const joinedAt = useRef(0);
  const away = useRef(false);

  useEffect(() => {
    function markAway() {
      if (sessionStorage.getItem(JOIN_RETURN_KEY) === "1") away.current = true;
    }
    function maybeOpen() {
      if (sessionStorage.getItem(JOIN_RETURN_KEY) !== "1" || !away.current) return;
      if (Date.now() - joinedAt.current < 600) return;
      sessionStorage.removeItem(JOIN_RETURN_KEY);
      away.current = false;
      if (stillNeeded) setOpen(true);
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") markAway();
      if (document.visibilityState === "visible") maybeOpen();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", markAway);
    window.addEventListener("focus", maybeOpen);
    let removeBrowser: (() => void) | undefined;
    if (isNativeApp()) {
      void import("@capacitor/browser").then(({ Browser }) => {
        const handle = Browser.addListener("browserFinished", () => {
          away.current = true;
          joinedAt.current = 0;
          maybeOpen();
        });
        removeBrowser = () => {
          void handle.then((listener) => listener.remove());
        };
      });
    }
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", markAway);
      window.removeEventListener("focus", maybeOpen);
      removeBrowser?.();
    };
  }, [stillNeeded]);

  const checkInClass = anyLive
    ? "inline-flex h-14 items-center rounded-[18px] bg-[#FDE68A] px-4 text-sm font-bold text-[#3B1A8C]"
    : "inline-flex h-14 items-center rounded-[18px] bg-white/20 px-4 text-sm font-bold text-white";
  const joinClass = anyLive
    ? "inline-flex h-14 items-center rounded-[18px] bg-white/20 px-4 text-sm font-bold text-white"
    : "inline-flex h-14 items-center rounded-[18px] bg-[#FDE68A] px-4 text-sm font-bold text-[#3B1A8C]";

  return (
    <>
      {canJoin && meetUrl ? (
        <a
          href={meetUrl}
          target="_blank"
          rel="noreferrer"
          className={joinClass}
          onClick={() => {
            if (!stillNeeded) return;
            joinedAt.current = Date.now();
            away.current = false;
            sessionStorage.setItem(JOIN_RETURN_KEY, "1");
          }}
        >
          Join
        </a>
      ) : (
        <span className="inline-flex h-14 items-center rounded-[18px] bg-white/20 px-4 text-sm font-bold">Join</span>
      )}
      <button type="button" data-testid="check-in-button" className={checkInClass} onClick={() => setOpen(true)}>
        {anyLive ? "Live now" : "Check in"}
      </button>
      <CheckInSheet
        open={open}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setStillNeeded(false);
          sessionStorage.removeItem(JOIN_RETURN_KEY);
        }}
      />
    </>
  );
}

export function CommunityHomeTile({
  href,
  status,
  showLive,
}: {
  href?: string;
  status: string;
  showLive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const className = "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-[18px] bg-white px-1 py-2 text-center text-[#1F1640]";
  const body = (
    <>
      <span className="text-[#5B21B6]">
        <Users className="h-4 w-4" />
      </span>
      <span className="text-[11px] font-extrabold leading-tight">Community</span>
      {showLive ? <span className="h-4" aria-hidden /> : <span className="text-[9px] font-semibold text-[#6B5F8A]">{status}</span>}
    </>
  );
  return (
    <div className="relative">
      {href ? (
        <NavLink href={href} className={className}>
          {body}
        </NavLink>
      ) : (
        <div className={className}>{body}</div>
      )}
      {showLive ? (
        <button
          type="button"
          data-testid="home-check-in-pill"
          className="absolute inset-x-1 bottom-1.5 z-10 rounded-full bg-[#FDE68A] px-1 py-0.5 text-[8px] font-bold leading-none text-[#3B1A8C]"
          onClick={() => setOpen(true)}
        >
          Live now · Check in
        </button>
      ) : null}
      <CheckInSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
