"use client";

import { useNativeApp } from "@/lib/native/native-app-context";
import { CANCEL_REASONS, type CancelReason } from "@/lib/stripe/cancel-reasons";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type CancelMembershipItem = {
  id: string;
  name: string;
  endsAt: string | null;
  nextAmountLabel: string | null;
  offerAvailable: boolean;
};

type Step = "idle" | "reason" | "offer" | "confirm" | "stayed" | "cancelled";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function CancelOne({ item }: { item: CancelMembershipItem }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const until = formatDate(item.endsAt);
  const community = item.name.includes("Community");

  async function send(action: "stay" | "cancel") {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/stripe/cancel-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: item.id, action, reason }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
      setStep(action === "stay" ? "stayed" : "cancelled");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const ghost =
    "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-60";
  const primary =
    "inline-flex items-center justify-center rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60";

  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <p className="font-semibold text-zinc-900">{item.name}</p>

      {step === "idle" ? (
        <button
          type="button"
          onClick={() => setStep("reason")}
          className="mt-2 text-sm font-medium text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
        >
          Cancel membership
        </button>
      ) : null}

      {step === "reason" ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-zinc-800">Sorry to see you go. What&apos;s the main reason?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(CANCEL_REASONS) as CancelReason[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={reason === key}
                onClick={() => setReason(key)}
                className={`rounded-full border px-3.5 py-2 text-sm transition-colors ${
                  reason === key
                    ? "border-violet-500 bg-violet-50 font-semibold text-violet-700"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {CANCEL_REASONS[key].label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!reason}
              onClick={() => setStep(item.offerAvailable ? "offer" : "confirm")}
              className={primary}
            >
              Continue
            </button>
            <button type="button" onClick={() => setStep("idle")} className={ghost}>
              Keep my membership
            </button>
          </div>
        </div>
      ) : null}

      {step === "offer" ? (
        <div className="mt-3 rounded-2xl border-2 border-violet-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Before you go</p>
          <p className="mt-1 font-heading text-xl font-bold text-zinc-900">Stay, and your next month is on us</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Your next {item.nextAmountLabel ?? ""} payment will be free.
            {community
              ? " You keep your weekly live practice, your pod and everything in Premium."
              : " You keep everything in Premium."}
            {community && reason === "times" ? " You can also switch to a session time that suits you better." : ""}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => send("stay")} className={primary}>
              {busy ? "Saving…" : "Stay and get a free month"}
            </button>
            <button type="button" disabled={busy} onClick={() => setStep("confirm")} className={ghost}>
              No thanks, cancel
            </button>
          </div>
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="mt-3">
          <p className="text-sm text-zinc-700">
            {until
              ? `Your membership will end on ${until}. You keep everything until then and won't be charged again.`
              : "Your membership will end at the end of your current period. You won't be charged again."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => send("cancel")} className={ghost}>
              {busy ? "Cancelling…" : "Cancel membership"}
            </button>
            <button type="button" disabled={busy} onClick={() => setStep("idle")} className={primary}>
              Keep my membership
            </button>
          </div>
        </div>
      ) : null}

      {step === "stayed" ? (
        <p className="mt-2 text-sm font-medium text-emerald-700">Done. Your next month is free. Glad you&apos;re staying!</p>
      ) : null}

      {step === "cancelled" ? (
        <p className="mt-2 text-sm text-zinc-700">
          {until ? `Cancelled. You keep everything until ${until}.` : "Cancelled. You keep everything until the end of your period."}
        </p>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

/** Cancel flow with a one-off "next month free" offer. Web only (not shown in the iOS/Android app). */
export function CancelMembership({ items }: { items: CancelMembershipItem[] }) {
  const native = useNativeApp();
  if (native || items.length === 0) return null;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <CancelOne key={item.id} item={item} />
      ))}
    </div>
  );
}
