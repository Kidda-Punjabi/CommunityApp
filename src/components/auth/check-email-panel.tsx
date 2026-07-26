"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  resendConfirmationEmail,
  type ResendConfirmationState,
} from "@/app/signup/resend-actions";

const initial: ResendConfirmationState = {};

type CheckEmailPanelProps = {
  email: string;
  /** Compact variant for login error state */
  variant?: "page" | "inline";
};

export function CheckEmailPanel({ email, variant = "page" }: CheckEmailPanelProps) {
  const [state, formAction, pending] = useActionState(resendConfirmationEmail, initial);

  if (variant === "inline") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">
          Confirm your email before signing in. We sent a link to{" "}
          <span className="font-semibold">{email || "your inbox"}</span>.
        </p>
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={pending || !email}
            className="text-sm font-semibold text-violet-700 underline hover:text-violet-600 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Resend confirmation email"}
          </button>
        </form>
        {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-xs text-emerald-700">{state.success}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          One more step
        </p>
        <h2 className="mt-2 font-heading text-xl font-bold text-zinc-900">
          Check your email to confirm
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-zinc-700">
          We sent a confirmation link to{" "}
          <span className="font-semibold text-zinc-900">{email}</span>. You must open that
          link before you can sign in — signing in without confirming will not work.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Tip: check spam or promotions if you don&apos;t see it within a minute.
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Resend confirmation email"}
        </button>
        {state.error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.error}</p>
        ) : null}
        {state.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}
      </form>

      <p className="text-center text-sm text-zinc-500">
        Already confirmed?{" "}
        <Link
          href={`/login?email=${encodeURIComponent(email)}`}
          className="font-semibold text-violet-600 hover:text-violet-500"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
