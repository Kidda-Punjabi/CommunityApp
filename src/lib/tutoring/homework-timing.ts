import { UK_DISPLAY_TIMEZONE } from "@/lib/calendar/uk-display-time";

export const HOMEWORK_NEAR_LESSON_WINDOW_MS = 24 * 60 * 60 * 1000;

export type HomeworkTimingState = "on_time" | "late" | "post_lesson" | "unknown";

export function homeworkTimingStateFromStartsAt(
  startsAt: string | null | undefined,
  now: Date = new Date()
): HomeworkTimingState {
  if (!startsAt) return "unknown";
  const startMs = new Date(startsAt).getTime();
  if (Number.isNaN(startMs)) return "unknown";
  const nowMs = now.getTime();
  if (startMs <= nowMs) return "post_lesson";
  if (startMs - nowMs <= HOMEWORK_NEAR_LESSON_WINDOW_MS) return "late";
  return "on_time";
}

/** Real kids class rows — not mis-tagged "Kidda Class - Cohort N" title_name meetings. */
export function isKidsHomeworkClassSession(row: {
  title?: string | null;
  match_method?: string | null;
  course_id?: string | null;
  kidsCourseId: string;
}): boolean {
  if (row.match_method === "title_name" || row.match_method === "unmatched") return false;
  const title = (row.title ?? "").trim().toLowerCase();
  if (!title || title.includes("meeting")) return false;
  if (title.includes("kidda class")) return false;
  if (row.course_id && row.course_id !== row.kidsCourseId) return false;
  return true;
}

export function formatKidsNextLessonWarning(startsAt: string): string {
  const start = new Date(startsAt);
  const date = start.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
  const time = start.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: UK_DISPLAY_TIMEZONE,
  });
  return `Your next lesson is on ${date} at ${time}. Submit before then to guarantee it's reviewed — after that it's up to your tutor.`;
}
