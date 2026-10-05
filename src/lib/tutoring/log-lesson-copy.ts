/** Pure copy and matching helpers for the tutor Log a lesson flow. */

const FINISHED_STATUSES = new Set([
  "classes_completed",
  "offboarding_complete",
  "incomplete",
  "postponed",
]);

export type TeachingClassRow = {
  name: string | null;
  active: boolean | null;
  status: string | null;
};

export function isTestClassName(name: string | null | undefined): boolean {
  return (name ?? "").toUpperCase().includes("TEST");
}

/** Finished classes stay behind the Classes tab link. Test names stay hidden. */
export function isFinishedTeachingClass(row: TeachingClassRow): boolean {
  if (isTestClassName(row.name)) return false;
  return Boolean(row.status && FINISHED_STATUSES.has(row.status));
}

/** Active classes only: not finished, not inactive, not archived (active = false), not test. */
export function isActiveTeachingClass(
  row: TeachingClassRow,
  options?: { includeTest?: boolean }
): boolean {
  if (row.active === false) return false;
  if (!options?.includeTest && isTestClassName(row.name)) return false;
  if (row.status && FINISHED_STATUSES.has(row.status)) return false;
  return true;
}

export function isFoundationalCourse(courseName: string | null | undefined): boolean {
  return (courseName ?? "").toLowerCase().includes("foundational");
}

export function lessonSlotLabel(courseName: string, lessonNumber: number): string {
  if (isFoundationalCourse(courseName)) return `Lesson ${lessonNumber}`;
  return `Week ${lessonNumber}`;
}

export function formatTaughtDate(lessonDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lessonDate.trim());
  if (!match) return lessonDate;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatLogNotionTitle(options: {
  name: string;
  courseName: string;
  lessonNumber: number;
  lessonDate: string;
}): string {
  const slot = lessonSlotLabel(options.courseName, options.lessonNumber);
  return `${options.name.trim()} - ${slot} - ${formatTaughtDate(options.lessonDate)} (app)`;
}

export function isHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export type LessonSlot = {
  lessonId: string;
  lessonNumber: number;
  title: string;
};

export function suggestNextLesson<T extends { lessonId: string; lessonNumber: number }>(
  lessons: T[],
  loggedLessonIds: Iterable<string>
): T | null {
  const logged = new Set(loggedLessonIds);
  const pending = lessons
    .filter((lesson) => !logged.has(lesson.lessonId))
    .sort((a, b) => a.lessonNumber - b.lessonNumber);
  return pending[0] ?? null;
}

export type ReadbackField =
  | "Title"
  | "Date"
  | "Lesson"
  | "Recording"
  | "Attendees"
  | "Absent"
  | "Tutor"
  | "Cover";

export type ReadbackDifference = {
  field: ReadbackField;
  submitted: string;
  actual: string;
};

export type LessonLogReadback = {
  title: string;
  date: string;
  lesson: string;
  recordingUrl: string;
  attendeeNames: string[];
  attendeeLeadIds: string[];
  absentNames: string[];
  tutorName: string;
  tutorMatched: boolean;
  coverSession?: boolean;
  notionUrl: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function namesClose(a: string, b: string): boolean {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function sameNameSet(submitted: string[], actual: string[]): boolean {
  const left = submitted.map((name) => name.trim()).filter(Boolean);
  const right = actual.map((name) => name.trim()).filter(Boolean);
  if (left.length !== right.length) return false;
  const used = new Set<number>();
  for (const name of left) {
    const index = right.findIndex((candidate, i) => !used.has(i) && namesClose(name, candidate));
    if (index < 0) return false;
    used.add(index);
  }
  return true;
}

export function compareLessonLogReadback(options: {
  submittedTitle: string;
  submittedDate: string;
  submittedLesson: string;
  submittedRecordingUrl: string;
  submittedPresentNames: string[];
  submittedAbsentNames: string[];
  actual: LessonLogReadback;
  unmatchedPresentNames: string[];
  droppedExistingLeadIds?: string[];
  expectedLeadIds?: string[];
  expectedCoverSession?: boolean;
}): ReadbackDifference[] {
  const diffs: ReadbackDifference[] = [];
  const actual = options.actual;

  if (norm(actual.title) !== norm(options.submittedTitle)) {
    diffs.push({
      field: "Title",
      submitted: options.submittedTitle,
      actual: actual.title || "(empty)",
    });
  }
  if (norm(actual.date) !== norm(options.submittedDate)) {
    diffs.push({
      field: "Date",
      submitted: options.submittedDate,
      actual: actual.date || "(empty)",
    });
  }
  const lessonOk =
    norm(actual.lesson) === norm(options.submittedLesson) ||
    norm(actual.title).includes(norm(options.submittedLesson));
  if (!lessonOk) {
    diffs.push({
      field: "Lesson",
      submitted: options.submittedLesson,
      actual: actual.lesson || actual.title || "(empty)",
    });
  }
  if (norm(actual.recordingUrl) !== norm(options.submittedRecordingUrl)) {
    diffs.push({
      field: "Recording",
      submitted: options.submittedRecordingUrl || "(none)",
      actual: actual.recordingUrl || "(none)",
    });
  }
  const presentActual = actual.attendeeNames;
  const dropped = options.droppedExistingLeadIds ?? [];
  const expectedLeadIds = options.expectedLeadIds;
  const leadIdsMatch =
    expectedLeadIds != null &&
    expectedLeadIds.every((id) =>
      actual.attendeeLeadIds.some(
        (kept) => kept.replace(/-/g, "").toLowerCase() === id.replace(/-/g, "").toLowerCase()
      )
    );
  const namesMatch = sameNameSet(options.submittedPresentNames, presentActual);
  if (
    options.unmatchedPresentNames.length > 0 ||
    dropped.length > 0 ||
    !(expectedLeadIds != null ? leadIdsMatch : namesMatch)
  ) {
    const missing = options.unmatchedPresentNames.length
      ? ` No Notion lead for ${options.unmatchedPresentNames.join(", ")}.`
      : "";
    const removed = dropped.length
      ? ` Existing attendees were dropped (${dropped.length}).`
      : "";
    diffs.push({
      field: "Attendees",
      submitted: options.submittedPresentNames.join(", ") || "(none)",
      actual: `${presentActual.join(", ") || "(none)"}${missing}${removed}`.trim(),
    });
  }
  const absentOnPage = options.submittedAbsentNames.filter((name) =>
    presentActual.some((actualName) => actualName.trim().toLowerCase() === name.trim().toLowerCase())
  );
  if (absentOnPage.length > 0) {
    diffs.push({
      field: "Absent",
      submitted: options.submittedAbsentNames.join(", ") || "(none)",
      actual: `Still on Attendees: ${absentOnPage.join(", ")}`,
    });
  }
  if (!actual.tutorMatched) {
    diffs.push({
      field: "Tutor",
      submitted: options.expectedCoverSession ? "Linked Notion tutor" : "No Actual Tutor",
      actual: actual.tutorName || "(not set on the page)",
    });
  }
  if (Boolean(options.expectedCoverSession) !== Boolean(actual.coverSession)) {
    diffs.push({
      field: "Cover",
      submitted: options.expectedCoverSession ? "Cover lesson" : "Not a cover lesson",
      actual: actual.coverSession ? "Cover lesson" : "Not a cover lesson",
    });
  }
  return diffs;
}

export function londonTimeLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/London",
  }).format(date);
}
