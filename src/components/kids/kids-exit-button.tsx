"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PinPad } from "@/components/kids/pin-pad";

export function KidsExitButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePin(pin: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/kids/exit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        setError(data.error ?? "Incorrect PIN.");
        return;
      }
      setOpen(false);
      router.push(data.redirectTo ?? "/dashboard/profile/kids");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-3 top-3 z-40 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow ring-1 ring-zinc-200 backdrop-blur hover:bg-white"
      >
        Exit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-sky-50 to-violet-50 p-6 shadow-xl">
            <PinPad
              title="Grown-up PIN"
              subtitle="Enter your PIN to switch back"
              onComplete={handlePin}
              onCancel={() => setOpen(false)}
              error={error}
              disabled={loading}
            />
          </div>
        </div>
      )}
    </>
  );
}
