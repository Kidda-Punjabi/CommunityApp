"use client";

import { useEffect, useState } from "react";
import { GameTutorialHost } from "@/components/games/tutorial/game-tutorial-host";
import { clearGameTutorialSeen } from "@/lib/games/tutorials/storage";

/**
 * Dev-only preview to verify group tutorial auto-open without creating a room.
 * Not linked from nav.
 */
export default function TutorialPreviewPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    clearGameTutorialSeen("chado_pauri_group");
    clearGameTutorialSeen("sentence_builder_group");
    setReady(true);
  }, []);

  if (process.env.NODE_ENV === "production") {
    return (
      <main className="p-8">
        <p className="text-sm text-zinc-500">Not available in production.</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="p-8">
        <p className="text-sm text-zinc-500">Preparing tutorial preview…</p>
      </main>
    );
  }

  return (
    <main className="space-y-8 p-8">
      <h1 className="text-xl font-bold text-zinc-900">Group tutorial preview</h1>
      <section className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-900">Chaṛo Pauṛī (group)</h2>
          <GameTutorialHost tutorialId="chado_pauri_group" />
        </div>
        <p className="text-sm text-zinc-500">
          Tutorial should auto-open (seen flag cleared before mount).
        </p>
      </section>
      <section className="space-y-3 rounded-2xl border border-zinc-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-zinc-900">Sentence Builder (group)</h2>
          <GameTutorialHost tutorialId="sentence_builder_group" />
        </div>
      </section>
    </main>
  );
}
