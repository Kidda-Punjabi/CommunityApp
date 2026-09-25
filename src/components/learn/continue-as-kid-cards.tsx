"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";

export type ContinueAsKid = {
  id: string;
  name: string;
  courseName: string | null;
};

export function ContinueAsKidCards({ kids }: { kids: ContinueAsKid[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function continueAs(kidProfileId: string) {
    setError(null);
    setPendingId(kidProfileId);
    try {
      const response = await fetch("/api/kids/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kidProfileId }),
      });
      const data = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not switch profile.");
        setPendingId(null);
        return;
      }
      router.push(data.redirectTo ?? "/dashboard/learn");
      router.refresh();
    } catch {
      setError("Could not switch profile.");
      setPendingId(null);
    }
  }

  if (kids.length === 0) return null;

  return (
    <div className="space-y-3">
      {kids.map((kid) => (
        <button
          key={kid.id}
          type="button"
          disabled={pendingId !== null}
          onClick={() => continueAs(kid.id)}
          className={cn(
            pressableClass,
            "block w-full rounded-3xl bg-violet-600 p-4 text-left text-white shadow-[0_8px_32px_-8px_rgba(124,58,237,0.45)] hover:bg-violet-500 disabled:opacity-70"
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-100">
            Continue as
          </p>
          <p className="mt-1 font-heading text-xl font-bold leading-snug">
            {pendingId === kid.id ? "Opening…" : kid.name}
          </p>
          {kid.courseName ? (
            <p className="mt-1 text-sm text-violet-100">{kid.courseName}</p>
          ) : null}
        </button>
      ))}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
