"use client";

import { useKidSession } from "@/components/kids/kid-session-provider";
import { PinPad } from "@/components/kids/pin-pad";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function KidsExitButton() {
  const router = useRouter();
  const { pinUnlocked } = useKidSession();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function goToSwitcher() {
    router.push("/dashboard/profile/kids");
    router.refresh();
  }

  async function handlePin(pin: string) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/kids/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Incorrect PIN.");
        return;
      }
      setOpen(false);
      goToSwitcher();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (pinUnlocked) {
            goToSwitcher();
            return;
          }
          setOpen(true);
        }}
        className="fixed right-3 top-3 z-40 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-zinc-600 shadow ring-1 ring-zinc-200 backdrop-blur hover:bg-white"
      >
        Switch profile
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-sky-50 to-violet-50 p-6 shadow-xl">
            <PinPad
              title="Grown-up PIN"
              subtitle="Enter your PIN to switch profiles"
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
