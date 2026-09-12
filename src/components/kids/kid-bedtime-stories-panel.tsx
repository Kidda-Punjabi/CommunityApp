import Link from "next/link";
import { PREMIUM_UNLOCK_PATH } from "@/lib/products/premium-checkout";
import type { KidBedtimeStory } from "@/lib/kids/bedtime-stories";

export function KidBedtimeStoriesPanel({
  stories,
  parentIsPremium,
  tableReady,
}: {
  stories: KidBedtimeStory[];
  parentIsPremium: boolean;
  tableReady: boolean;
}) {
  if (!tableReady) return null;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-zinc-900">Bedtime stories</h2>
        {!parentIsPremium ? (
          <Link href={PREMIUM_UNLOCK_PATH} className="text-xs font-semibold text-violet-600">
            Premium →
          </Link>
        ) : null}
      </div>
      {stories.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          Stories are coming soon — check back after a grown-up adds some.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {stories.map((story) => (
            <li
              key={story.id}
              className={`rounded-2xl px-3 py-3 text-sm ${
                story.unlocked ? "bg-sky-50 text-sky-900" : "bg-zinc-50 text-zinc-500"
              }`}
            >
              <span className="font-semibold">{story.title}</span>
              {!story.unlocked ? (
                <span className="mt-0.5 block text-xs">Unlock with Premium</span>
              ) : story.playableAudioUrl ? (
                <audio
                  className="mt-2 w-full"
                  controls
                  preload="none"
                  src={story.playableAudioUrl}
                >
                  Your browser does not support audio.
                </audio>
              ) : (
                <span className="mt-0.5 block text-xs text-sky-700/70">Audio coming soon</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
