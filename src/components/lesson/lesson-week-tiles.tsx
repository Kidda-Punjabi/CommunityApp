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

type LessonWeekTilesProps = {
  presentationUrl: string | null;
  recordingUrl: string | null;
  recordingTitle: string | null;
  showHomework: boolean;
  homework: HomeworkSubmissionView | null;
  lessonId: string;
  homeworkCatchupReturn?: string | null;
  quiz: { href: string; statusLabel: string; tone: StatusTone } | null;
  practiceHref: string;
  hasSubmittedFeedback: boolean;
  /** Beginners Course lesson 1 starting-point survey (separate from session feedback). */
  startingPointHref?: string | null;
  /** When set, replaces the Recording hero tile (1-to-1 late-cancel catch-up). */
  sessionCatchupHref?: string | null;
};

const toneClass: Record<StatusTone, string> = {
  accent: "text-violet-700",
  success: "text-emerald-700",
  muted: "text-zinc-500",
  neutral: "text-zinc-600",
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

export function LessonWeekTiles({
  presentationUrl,
  recordingUrl,
  recordingTitle,
  showHomework,
  homework,
  lessonId,
  homeworkCatchupReturn = null,
  quiz,
  practiceHref,
  hasSubmittedFeedback,
  startingPointHref = null,
  sessionCatchupHref = null,
}: LessonWeekTilesProps) {
  const hw = homeworkTileState(homework);

  return (
    <div className="space-y-3 pt-3">
      <NavLink
          href={practiceHref}
          className="flex h-[76px] items-center justify-center rounded-[20px] bg-violet-600 text-[27px] font-extrabold text-white shadow-[0_5px_0_#5B21B6] transition active:scale-[0.98]"
        >
          Practice
        </NavLink>
      {startingPointHref ? (
        <NavLink
          href={startingPointHref}
          className="block rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 hover:bg-violet-100"
        >
          <p className="text-sm font-semibold text-violet-900">Starting point</p>
          <p className="mt-0.5 text-xs text-violet-800">
            How confident do you feel at the beginning of the course?
          </p>
        </NavLink>
      ) : null}
      <div className={"grid grid-cols-2 gap-2.5 pt-1"}>
        <ActivityTile
          label="Slides"
          statusLabel={presentationUrl ? "Open" : "Not yet"}
          tone="neutral"
          icon={<SlidesIcon />}
          href={presentationUrl}
          external
        />
        {sessionCatchupHref ? (
          <ActivityTile
            label="Catch up"
            statusLabel="Watch"
            tone="neutral"
            icon={<CatchupIcon />}
            href={sessionCatchupHref}
            title="Catch up on this missed session"
          />
        ) : (
          <ActivityTile
            label="Recording"
            statusLabel={recordingUrl ? "Watch" : "Not yet"}
            tone="neutral"
            icon={<RecordingIcon />}
            href={recordingUrl}
            external
            title={recordingTitle ?? undefined}
          />
        )}
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
      </div>
      <NavLink
        href={
          hasSubmittedFeedback
            ? `/dashboard/feedback/${lessonId}/history`
            : `/dashboard/feedback/${lessonId}`
        }
        className="flex min-h-11 items-center justify-center text-sm font-extrabold text-violet-700"
      >
        {hasSubmittedFeedback ? "View your feedback on this lesson" : "Share feedback on this lesson"}
      </NavLink>
    </div>
  );
}

function ActivityTile({
  label,
  statusLabel,
  tone,
  showDot = false,
  icon,
  href,
  external = false,
  title,
}: {
  label: string;
  statusLabel: string;
  tone: StatusTone;
  showDot?: boolean;
  icon: ReactNode;
  href?: string | null;
  external?: boolean;
  title?: string;
}) {
  const className = cn(
    "flex min-h-[62px] items-center gap-2.5 rounded-[18px] border border-[#ECE9F5] bg-white p-2.5 text-left transition-colors",
    href ? "hover:border-violet-200" : "cursor-not-allowed opacity-50"
  );

  const body = (
    <>
      <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#F1EBFF] text-violet-700 [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold leading-tight text-zinc-900">{label}</span>
        <span className={cn("mt-0.5 inline-flex items-center gap-1 text-xs font-semibold leading-tight", toneClass[tone])}>
          {showDot ? <span className="h-1 w-1 shrink-0 rounded-full bg-violet-600" aria-hidden="true" /> : null}
          {statusLabel}
        </span>
      </span>
    </>
  );

  if (!href) {
    return (
      <div className={className} title={title ?? `${label} not available yet`}>
        {body}
      </div>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} title={title}>
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
