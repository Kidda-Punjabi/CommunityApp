"use client";

import { useState, type ReactNode } from "react";
import { PublicGuestGate } from "@/components/public-forms/public-guest-gate";
import type { GuestIdentity } from "@/lib/public-forms/guest";

export function PublicFormFrame({
  heading,
  children,
}: {
  heading: { kicker: string; title: string; intro: string };
  children: (identity: GuestIdentity) => ReactNode;
}) {
  const [identity, setIdentity] = useState<GuestIdentity | null>(null);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
        {heading.kicker}
      </p>
      <h1 className="mt-1 text-2xl font-bold text-zinc-900">{heading.title}</h1>
      <p className="mt-2 text-sm text-zinc-600">{heading.intro}</p>
      <div className="mt-6">
        {!identity ? <PublicGuestGate onContinue={setIdentity} /> : children(identity)}
      </div>
    </div>
  );
}
