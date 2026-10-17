"use client";

import Link from "next/link";
import { useState } from "react";

export function OnboardingFrame({
  step,
  backHref,
  children,
  action,
}: {
  step?: string;
  backHref?: string;
  children: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="-mx-5 -mt-4 flex min-h-[calc(100dvh-5.5rem-env(safe-area-inset-bottom))] flex-col bg-[#F7F5FC] px-5 pt-[max(0.75rem,env(safe-area-inset-top))] font-[family-name:var(--font-community)] text-[#1F1640]">
      <div className="flex h-11 items-center gap-3">
        {backHref ? (
          <Link href={backHref} className="inline-flex min-h-11 min-w-11 items-center text-sm font-semibold text-[#4A3F66]">
            Back
          </Link>
        ) : <span className="min-w-11" />}
        {step ? (
          <div className="flex flex-1 flex-col gap-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-[#E7E0F4]">
              <div className="h-full rounded-full bg-[#7C3AED]" style={{ width: step === "1 of 3" ? "33%" : step === "2 of 3" ? "66%" : "100%" }} />
            </div>
            <p className="text-center text-xs font-semibold text-[#6B5F8A]">{step}</p>
          </div>
        ) : <span className="flex-1" />}
        <span className="min-w-11" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-between py-3">{children}</div>
      <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))]">{action}</div>
    </div>
  );
}

export function OnboardingButton({
  children,
  onClick,
  disabled,
  tone = "purple",
  href,
}: {
  children: React.ReactNode;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  tone?: "purple" | "gold";
  href?: string;
}) {
  const [pending, setPending] = useState(false);
  const className = `flex h-14 w-full items-center justify-center rounded-[18px] text-base font-bold active:scale-[0.98] disabled:opacity-70 ${
    tone === "gold" ? "bg-[#FDE68A] text-[#3B1A8C]" : "bg-[#7C3AED] text-white"
  }`;
  if (href) {
    return <Link href={href} prefetch className={className}>{children}</Link>;
  }
  return (
    <button
      type="button"
      className={className}
      disabled={disabled || pending}
      onClick={() => {
        if (!onClick) return;
        setPending(true);
        void Promise.resolve(onClick()).finally(() => setPending(false));
      }}
    >
      {pending ? "Saving..." : children}
    </button>
  );
}
