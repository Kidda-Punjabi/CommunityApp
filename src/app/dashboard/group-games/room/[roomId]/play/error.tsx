"use client";

import Link from "next/link";
import { ui } from "@/lib/ui/styles";

/** Catches a crash inside a game screen so players always have a way out. */
export default function GamePlayError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className={ui.page}>
      <div className={`${ui.card} space-y-4 text-center`}>
        <h1 className="text-2xl font-bold text-zinc-900">This game hit a problem</h1>
        <p className="text-sm text-zinc-600">Try once more, or head back and pick another game.</p>
        <button type="button" onClick={reset} className={ui.btnPrimaryBlock}>
          Try again
        </button>
        <Link href="/dashboard/community" className={`${ui.btnSecondary} w-full justify-center`}>
          Back to Community
        </Link>
      </div>
    </div>
  );
}
