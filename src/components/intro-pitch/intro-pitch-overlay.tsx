"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { dismissIntroPitch } from "@/app/dashboard/intro-pitch/actions";
import { BOOK_CALL_PATH } from "@/lib/booking/constants";
import {
  INTRO_PITCH_SCREENS,
  INTRO_PITCH_TOTAL_SCREENS,
  type IntroPitchScreen,
} from "@/lib/intro-pitch/screens";

type IntroPitchOverlayProps = {
  isTestMode: boolean;
  onClose: () => void;
};

function ProgressBar({ step }: { step: number }) {
  const pct = ((step + 1) / INTRO_PITCH_TOTAL_SCREENS) * 100;

  return (
    <div className="space-y-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
        <div
          className="h-full rounded-full bg-violet-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-center text-xs text-zinc-500">
        {step + 1} of {INTRO_PITCH_TOTAL_SCREENS}
      </p>
    </div>
  );
}

function VisualPanel({ screen }: { screen: IntroPitchScreen }) {
  if (screen.visual === "welcome") {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-violet-50 px-6 py-10 text-center">
        <p className="font-semibold uppercase tracking-[0.2em] text-violet-600">Kidda</p>
        <p className="mt-4 text-4xl" aria-hidden="true">
          🪷
        </p>
      </div>
    );
  }

  if (screen.visual === "pain") {
    return (
      <div className="rounded-2xl border border-violet-200 bg-violet-50/60 px-4 py-5 text-center">
        <p className="text-sm font-medium text-violet-900">You&apos;re not alone in this.</p>
        <p className="mt-1 text-xs text-violet-700">Most learners hit the same walls.</p>
      </div>
    );
  }

  if (screen.visual === "barriers") {
    return (
      <div className="grid grid-cols-3 gap-2 text-center">
        {["🧭", "👥", "💬"].map((emoji) => (
          <div
            key={emoji}
            className="rounded-xl border border-zinc-200 bg-white px-2 py-4 text-2xl"
            aria-hidden="true"
          >
            {emoji}
          </div>
        ))}
      </div>
    );
  }

  if (screen.visual === "approach") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 text-center">
        <p className="text-sm font-semibold text-emerald-900">Live teaching + community practice</p>
        <p className="mt-1 text-xs text-emerald-800">Real conversations, real progress</p>
      </div>
    );
  }

  if (screen.visual === "outcomes") {
    return (
      <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-5 text-center">
        <p className="text-3xl font-bold text-violet-700" aria-hidden="true">
          ✦
        </p>
        <p className="mt-2 text-sm font-medium text-violet-900">Confidence in real conversations</p>
      </div>
    );
  }

  if (screen.visual === "cta") {
    return (
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-600 to-violet-500 px-4 py-6 text-center text-white">
        <p className="text-sm font-semibold">Free call · No obligation</p>
        <p className="mt-1 text-xs text-violet-100">Talk to a real person on the Kidda team</p>
      </div>
    );
  }

  return null;
}

export function IntroPitchOverlay({ isTestMode, onClose }: IntroPitchOverlayProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const screen = INTRO_PITCH_SCREENS[step];
  const isLastScreen = step >= INTRO_PITCH_TOTAL_SCREENS - 1;

  async function finish() {
    setSaving(true);
    await dismissIntroPitch(isTestMode);
    setSaving(false);
    onClose();
  }

  async function handleSkip() {
    await finish();
  }

  async function handleNext() {
    if (isLastScreen) return;
    setStep((current) => current + 1);
  }

  async function handleBookCall() {
    setSaving(true);
    await dismissIntroPitch(isTestMode);
    setSaving(false);
    onClose();
    router.push(BOOK_CALL_PATH);
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-zinc-900/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          {isTestMode ? (
            <span className="text-xs font-medium text-violet-600">Admin preview</span>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={saving}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
          >
            Skip
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <ProgressBar step={step} />

          <div className="mt-6 space-y-4">
            <h2 className="text-xl font-bold leading-snug text-zinc-900">{screen.title}</h2>

            {screen.body ? (
              <p className="text-sm leading-relaxed text-zinc-600">{screen.body}</p>
            ) : null}

            {screen.bullets ? (
              <ul className="space-y-2.5">
                {screen.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-3 text-sm leading-relaxed text-zinc-700"
                  >
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500"
                      aria-hidden="true"
                    />
                    {bullet}
                  </li>
                ))}
              </ul>
            ) : null}

            {screen.cards ? (
              <div className="space-y-3">
                {screen.cards.map((card) => (
                  <div
                    key={card.title}
                    className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3"
                  >
                    <p className="font-semibold text-zinc-900">{card.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-600">{card.description}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <VisualPanel screen={screen} />
          </div>
        </div>

        <div className="space-y-2 border-t border-zinc-100 px-5 py-4">
          {isLastScreen ? (
            <>
              <button
                type="button"
                onClick={() => void handleBookCall()}
                disabled={saving}
                className="w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
              >
                Book a free call with our team
              </button>
              <button
                type="button"
                onClick={() => void handleSkip()}
                disabled={saving}
                className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
              >
                Explore the app
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void handleNext()}
              disabled={saving}
              className="w-full rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
