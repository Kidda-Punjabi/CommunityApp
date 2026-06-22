import type { LessonRecordingView } from "@/lib/tutoring/lesson-content-access";
import { recordingEmbedUrl } from "@/lib/tutoring/lesson-content-access";

type LessonRecordingPlayerProps = {
  recording: LessonRecordingView;
};

export function LessonRecordingPlayer({ recording }: LessonRecordingPlayerProps) {
  const embedUrl = recordingEmbedUrl(recording.url);

  return (
    <div className="mt-4 space-y-2 border-t border-zinc-100 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Session recording
      </p>
      {recording.title && (
        <p className="text-sm font-medium text-zinc-700">{recording.title}</p>
      )}
      {embedUrl ? (
        <div className="aspect-video overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900">
          <iframe
            src={embedUrl}
            title={recording.title ?? "Lesson recording"}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <a
          href={recording.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100"
        >
          Open session recording →
        </a>
      )}
    </div>
  );
}
