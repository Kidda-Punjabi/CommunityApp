"use client";

import { AudioPanel } from "@/app/admin/content/components/audio-panel";
import type { AdminData } from "@/app/admin/content/types";

type LessonAudioPanelProps = {
  lesson: AdminData["lessons"][0];
};

/** @deprecated Use AudioPanel with contentType="lesson" */
export function LessonAudioPanel({ lesson }: LessonAudioPanelProps) {
  return (
    <AudioPanel
      contentType="lesson"
      contentId={lesson.id}
      defaultScript={lesson.audio_script ?? ""}
    />
  );
}
