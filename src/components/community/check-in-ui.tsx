"use client";

import { checkInByCode, submitCheckIn } from "@/app/dashboard/community/actions";
import { takeCheckinChars } from "@/lib/community/checkin-code";
import type { CheckInSuccess } from "@/lib/community/check-in-types";
import { levelFillVar } from "@/lib/community/levels";
import { isNativeApp } from "@/lib/native/platform";
import { notifyXpEarned } from "@/lib/points/notify-points-earned";
import { AppTile } from "@/components/ui/app-tile";
import { Users } from "lucide-react";
import Link from "next/link";
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
  // One real input drawn as four boxes. Separate inputs made phones reset the keyboard
  // to letters every time focus jumped to the next box, which broke typing numbers.
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [success, setSuccess] = useState<CheckInSuccess | null>(null);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const busy = useRef(false);

  async function submit(value: string) {
    if (value.length < 4 || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    const result = occurrenceId ? await submitCheckIn(occurrenceId, value) : await checkInByCode(value);
    busy.current = false;
    setPending(false);
    if ("error" in result && result.error) {
      setError(result.error);
      setCode("");
      inputRef.current?.focus();
      return;
    }
    if ("ok" in result && result.ok) {
      if (result.xpAwarded > 0) notifyXpEarned(result.xpAwarded);
      setSuccess(result);
      onSuccess?.();
      router.refresh();
    }
  }

  function update(raw: string) {
    const chars = takeCheckinChars(raw);
    setCode(chars);
    setError(null);
    if (chars.length >= 4) void submit(chars);
  }

  if (success) return <SuccessView result={success} />;

  const activeIndex = Math.min(code.length, 3);

  return (
    <div>
      <label htmlFor="community-checkin-code" className="block text-base font-semibold text-[#1F1640]">
        Enter the code Arsh shows on screen
      </label>
      <div className="relative mt-4" onClick={() => inputRef.current?.focus()}>
        <div className="grid grid-cols-4 gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`flex h-16 items-center justify-center rounded-[18px] border bg-[#F7F5FC] text-3xl font-extrabold uppercase text-[#1F1640] ${
                focused && index === activeIndex && !pending ? "border-[#5B21B6] ring-2 ring-[#DDD6FE]" : "border-[#E4DFEE]"
              } ${pending ? "opacity-60" : ""}`}
            >
              {code[index] ?? ""}
            </div>
          ))}
        </div>
        <input
          id="community-checkin-code"
          ref={inputRef}
          value={code}
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="one-time-code"
          spellCheck={false}
          maxLength={4}
          disabled={pending}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => update(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
          style={{ fontSize: 16, caretColor: "transparent" }}
        />
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
  live,
  openOnMount = false,
}: {
  meetUrl: string | null;
  live: boolean;
  openOnMount?: boolean;
}) {
  const [open, setOpen] = useState(openOnMount);
  const [stillNeeded, setStillNeeded] = useState(live);
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

  if (!live) return null;

  return (
    <>
      <button
        type="button"
        data-testid="check-in-button"
        className="flex h-14 w-full items-center justify-center rounded-[18px] bg-[#FDE68A] text-base font-bold text-[#3B1A8C]"
        onClick={() => setOpen(true)}
      >
        Check in
      </button>
      {meetUrl ? (
        <a
          href={meetUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex h-11 w-full items-center justify-center rounded-[18px] bg-white/15 text-sm font-bold text-white"
          onClick={() => {
            if (!stillNeeded) return;
            joinedAt.current = Date.now();
            away.current = false;
            sessionStorage.setItem(JOIN_RETURN_KEY, "1");
          }}
        >
          Join the call
        </a>
      ) : null}
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
  href = "/dashboard/community",
  status,
  showLive,
}: {
  href?: string;
  status: string;
  showLive: boolean;
}) {
  return (
    <div className="relative h-24">
      <AppTile href={href} title="Community" subtitle={status} icon={<Users className="h-4 w-4" />} />
      {showLive ? (
        <Link
          href="/dashboard/community?checkin=1"
          data-testid="home-check-in-pill"
          className="absolute inset-x-1 bottom-1.5 z-10 rounded-full bg-[#FDE68A] px-1 py-0.5 text-center text-[8px] font-bold leading-none text-[#3B1A8C]"
        >
          Check in
        </Link>
      ) : null}
    </div>
  );
}
