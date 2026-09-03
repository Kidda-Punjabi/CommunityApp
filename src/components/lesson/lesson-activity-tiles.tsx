"use client";

import { type ReactNode } from "react";
import { NavLink } from "@/components/ui/nav-link";
import {
  LessonHomeworkIcon,
  LessonQuizIcon,
} from "@/components/lesson/lesson-activity-icons";
import { lessonHomeworkPath } from "@/lib/tutoring/homework-href";
import type { HomeworkSubmissionView } from "@/lib/tutoring/homework-submissions";
import { cn } from "@/lib/ui/styles";

type StatusTone = "accent" | "success" | "muted" | "neutral";

type LessonActivityTilesProps = {
  presentationUrl: string | null;
  recordingUrl: string | null;
  recordingTitle: string | null;
  showHomework: boolean;
  homework: HomeworkSubmissionView | null;
  lessonId: string;
  homeworkCatchupReturn?: string | null;
  quiz: { href: string; statusLabel: string; tone: StatusTone } | null;
  flashcards: { href: string; statusLabel: string; tone: StatusTone } | null;
  hasSubmittedFeedback: boolean;
  /** When set, replaces the Recording hero tile (1-to-1 late-cancel catch-up). */
  sessionCatchupHref?: string | null;
};

const toneClass: Record<StatusTone, string> = {
  accent: "text-violet-700",
  success: "text-emerald-700",
  muted: "text-zinc-400",
  neutral: "text-zinc-500",
};

function homeworkTileState(homework: HomeworkSubmissionView | null): {
  statusLabel: string;
  tone: StatusTone;
  showDot: boolean;
} {
  if (!homework) {
    return { statusLabel: "Pending", tone: "accent", showDot: true };
  }
  if (homework.status === "pending_review") {
    return { statusLabel: "Sent", tone: "neutral", showDot: false };
  }
  if (homework.approved) {
    return { statusLabel: "Done", tone: "success", showDot: false };
  }
  return { statusLabel: "Notes", tone: "accent", showDot: true };
}

export function LessonActivityTiles({
  presentationUrl,
  recordingUrl,
  recordingTitle,
  showHomework,
  homework,
  lessonId,
  homeworkCatchupReturn = null,
  quiz,
  flashcards,
  hasSubmittedFeedback,
  sessionCatchupHref = null,
}: LessonActivityTilesProps) {
  const hw = homeworkTileState(homework);
  const activityCount =
    (showHomework ? 1 : 0) + (quiz ? 1 : 0) + (flashcards ? 1 : 0) + 1;

  return (
    <div className="space-y-3 pt-2">
      <div className="grid grid-cols-2 gap-2">
        <HeroTile
          label="Slides"
          icon={<SlidesIcon />}
          href={presentationUrl}
          external
          disabled={!presentationUrl}
          tint="violet"
        />
        {sessionCatchupHref ? (
          <HeroTile
            label="Catch up"
            icon={<CatchupIcon />}
            href={sessionCatchupHref}
            tint="sky"
            title="Catch up on this missed session"
          />
        ) : (
          <HeroTile
            label="Recording"
            icon={<RecordingIcon />}
            href={recordingUrl}
            external
            disabled={!recordingUrl}
            tint="sky"
            title={recordingTitle ?? undefined}
          />
        )}
      </div>

      <div
        className={cn(
          "grid gap-2",
          activityCount >= 4 ? "grid-cols-4" : activityCount === 3 ? "grid-cols-3" : "grid-cols-2"
        )}
      >
        {showHomework ? (
          <ActivityTile
            label="Homework"
            statusLabel={hw.statusLabel}
            tone={hw.tone}
            showDot={hw.showDot}
            icon={<LessonHomeworkIcon />}
            href={lessonHomeworkPath(lessonId, homeworkCatchupReturn)}
          />
        ) : null}
        {quiz ? (
          <ActivityTile
            label="Quiz"
            statusLabel={quiz.statusLabel}
            tone={quiz.tone}
            icon={<LessonQuizIcon />}
            href={quiz.href}
          />
        ) : null}
        {flashcards ? (
          <ActivityTile
            label="Flashcards"
            statusLabel={flashcards.statusLabel}
            tone={flashcards.tone}
            icon={<FlashcardsIcon />}
            href={flashcards.href}
          />
        ) : null}
        <ActivityTile
          label="Feedback"
          statusLabel={hasSubmittedFeedback ? "View" : "Share"}
          tone={hasSubmittedFeedback ? "neutral" : "accent"}
          showDot={!hasSubmittedFeedback}
          icon={<FeedbackIcon />}
          href={
            hasSubmittedFeedback
              ? `/dashboard/feedback/${lessonId}/history`
              : `/dashboard/feedback/${lessonId}`
          }
        />
      </div>
    </div>
  );
}

function HeroTile({
  label,
  icon,
  href,
  external = false,
  disabled = false,
  tint,
  title,
}: {
  label: string;
  icon: ReactNode;
  href?: string | null;
  external?: boolean;
  disabled?: boolean;
  tint: "violet" | "sky";
  title?: string;
}) {
  const className = cn(
    "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-center transition-colors",
    tint === "violet" && "bg-violet-50 text-violet-800",
    tint === "sky" && "bg-sky-50 text-sky-900",
    disabled
      ? "cursor-not-allowed opacity-45"
      : tint === "violet"
        ? "hover:bg-violet-100"
        : "hover:bg-sky-100"
  );

  const body = (
    <>
      <span
        className={cn(
          "[&_svg]:h-5 [&_svg]:w-5",
          tint === "violet" ? "text-violet-600" : "text-sky-700"
        )}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </>
  );

  if (disabled || !href) {
    return (
      <div className={className} title={title ?? `${label} not available yet`}>
        {body}
      </div>
    );
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={title}
      >
        {body}
      </a>
    );
  }

  return (
    <NavLink href={href} className={className} title={title}>
      {body}
    </NavLink>
  );
}

function ActivityTile({
  label,
  statusLabel,
  tone,
  showDot = false,
  icon,
  href,
  onClick,
  active = false,
}: {
  label: string;
  statusLabel: string;
  tone: StatusTone;
  showDot?: boolean;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const className = cn(
    "flex min-h-[4.75rem] flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-2 text-center transition-colors",
    active
      ? "border-violet-200 bg-violet-50"
      : "border-zinc-100 bg-zinc-50 hover:border-zinc-200 hover:bg-zinc-100"
  );

  const body = (
    <>
      <span className="text-zinc-600 [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className="text-[11px] font-semibold leading-tight text-zinc-900">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-[10px] font-medium leading-tight",
          toneClass[tone]
        )}
      >
        {showDot ? (
          <span className="h-1 w-1 shrink-0 rounded-full bg-violet-600" aria-hidden="true" />
        ) : null}
        {statusLabel}
      </span>
    </>
  );

  if (href) {
    return (
      <NavLink href={href} className={className}>
        {body}
      </NavLink>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function SlidesIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M3.5 3.75A1.75 1.75 0 0 1 5.25 2h9.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.75 14h-9.5A1.75 1.75 0 0 1 3.5 12.25v-8.5ZM5.25 3.5a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25h-9.5Z" />
      <path d="M6 16.25a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 0 1.5h-6.5a.75.75 0 0 1-.75-.75Z" />
    </svg>
  );
}

function RecordingIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M2 6.75A2.75 2.75 0 0 1 4.75 4h10.5A2.75 2.75 0 0 1 18 6.75v6.5A2.75 2.75 0 0 1 15.25 16H4.75A2.75 2.75 0 0 1 2 13.25v-6.5ZM8.5 7.5v5l4.25-2.5L8.5 7.5Z" />
    </svg>
  );
}

function CatchupIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10 2a8 8 0 1 0 8 8h-1.5A6.5 6.5 0 1 1 10 3.5V2Z" />
      <path d="M10.75 5.75a.75.75 0 0 0-1.5 0v4.19l-2.22 2.22a.75.75 0 1 0 1.06 1.06l2.47-2.47a.75.75 0 0 0 .19-.53V5.75Z" />
    </svg>
  );
}

function FlashcardsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M4 4.75A1.75 1.75 0 0 1 5.75 3h8.5A1.75 1.75 0 0 1 16 4.75v7.5A1.75 1.75 0 0 1 14.25 14h-8.5A1.75 1.75 0 0 1 4 12.25v-7.5Z" />
      <path d="M6.5 15.5a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Z" />
    </svg>
  );
}

function FeedbackIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M3.5 4.75A1.75 1.75 0 0 1 5.25 3h9.5c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0 1 14.75 13H11.1l-2.72 2.72A.75.75 0 0 1 7 15.25V13H5.25A1.75 1.75 0 0 1 3.5 11.25v-6.5Z" />
    </svg>
  );
}
