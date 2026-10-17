"use client";

import { HomeworkAudioPlayer } from "@/components/homework/homework-audio-player";
import { getTutorFeedbackPlaybackUrl } from "@/app/dashboard/learn/homework-actions";

export function TutorFeedbackPlayer({
  storagePath,
  durationSeconds,
}: {
  storagePath: string;
  durationSeconds: number | null;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-zinc-500">Voice note</p>
      <div className="mt-1.5">
        <HomeworkAudioPlayer
          storagePath={storagePath}
          durationSeconds={durationSeconds}
          loadPlaybackUrl={getTutorFeedbackPlaybackUrl}
        />
      </div>
    </div>
  );
}
