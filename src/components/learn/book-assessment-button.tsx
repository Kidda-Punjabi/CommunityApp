"use client";

import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { useState } from "react";

export function BookAssessmentButton() {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setDone(true)}
      className={cn(
        pressableClass,
        "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
      )}
    >
      {done ? "Booking coming soon" : "Book assessment"}
    </button>
  );
}
