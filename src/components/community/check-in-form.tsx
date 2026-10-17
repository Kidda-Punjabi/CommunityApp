"use client";

import { submitCheckIn } from "@/app/dashboard/community/actions";
import { InlineSpinner } from "@/components/ui/page-spinner";
import { notifyXpEarned } from "@/lib/points/notify-points-earned";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

export function CheckInForm({ occurrenceId }: { occurrenceId: string }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const busy = useRef(false);

  async function submit(next = digits) {
    const code = next.join("");
    if (code.length < 4 || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    const result = await submitCheckIn(occurrenceId, code);
    busy.current = false;
    setPending(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("ok" in result && result.ok) {
      if (result.xpAwarded > 0) notifyXpEarned(result.xpAwarded);
      const timing = result.isLate ? "Late" : "On time";
      const streak = result.countsForStreak && result.streak > 0 ? ` · ${result.streak}-week streak` : "";
      setMessage(`You're checked in · ${timing}${streak}`);
      router.refresh();
    }
  }

  return (
    <div className="pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <p className="text-sm text-zinc-600">Enter the 4-character code from the session.</p>
      <div className="mt-4 flex justify-between gap-2">
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
            maxLength={1}
            aria-label={`Code character ${index + 1}`}
            disabled={pending}
            className="h-14 w-14 rounded-2xl border border-zinc-200 text-center text-[16px] font-semibold uppercase disabled:opacity-60"
            onChange={(event) => {
              const value = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(-1);
              const next = [...digits];
              next[index] = value;
              setDigits(next);
              if (value && index < 3) refs.current[index + 1]?.focus();
              if (next.every(Boolean)) void submit(next);
            }}
          />
        ))}
      </div>
      {pending ? <p className="mt-4"><InlineSpinner /></p> : null}
      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <div className="mt-6 rounded-3xl bg-white p-4 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]">
          <p className="font-heading text-lg font-semibold text-zinc-900">{message}</p>
          <p className="mt-2 text-sm text-zinc-600">Say hello: share one good thing from your day in the Meet chat.</p>
        </div>
      ) : null}
    </div>
  );
}
