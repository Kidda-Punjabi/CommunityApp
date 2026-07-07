import type { FeedbackHistoryEntry } from "@/lib/feedback/load-feedback-history";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

type LessonFeedbackHistoryPanelProps = {
  entries: FeedbackHistoryEntry[];
  lessonId: string;
  giveFeedbackHref: string;
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function RatingRow({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-zinc-600">{label}</span>
      <span className="font-semibold tabular-nums text-zinc-900">{value}/5</span>
    </div>
  );
}

export function LessonFeedbackHistoryPanel({
  entries,
  lessonId,
  giveFeedbackHref,
}: LessonFeedbackHistoryPanelProps) {
  if (entries.length === 0) {
    return (
      <div className={`${ui.cardBordered} text-center`}>
        <p className="text-sm text-zinc-600">You haven&apos;t submitted feedback for this lesson yet.</p>
        <Link href={giveFeedbackHref} className={`mt-4 inline-block ${ui.btnPrimary}`}>
          Give feedback
        </Link>
      </div>
    );
  }

  return (
    <div className={ui.stack}>
      {entries.map((entry) => (
        <article key={entry.id} className={`${ui.cardBordered} space-y-3`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Submitted {formatDate(entry.submittedAt)}
          </p>
          <div className="space-y-2">
            <RatingRow label="Learning relevance" value={entry.learningRelevance} />
            <RatingRow label="Tutor effectiveness" value={entry.tutorEffectiveness} />
            <RatingRow label="Confidence" value={entry.confidence} />
            <RatingRow label="Understanding" value={entry.understanding} />
            <RatingRow label="Speaking" value={entry.speaking} />
            <RatingRow label="Overall score" value={entry.overallScore} />
          </div>
          {entry.comments.trim() ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Comments</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{entry.comments}</p>
            </div>
          ) : null}
        </article>
      ))}
      <Link
        href={giveFeedbackHref}
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        Submit new feedback →
      </Link>
    </div>
  );
}
