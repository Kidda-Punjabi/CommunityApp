/**
 * Buzz-in topic catalogue: what the host can pick (a course week, everyday themes, or a
 * course's mixed pool), mapped onto the existing flashcard topic_tags.
 *
 * This only maps tags; it never renames them, so other games that read topic_tags are
 * unaffected. Duplicate tags ("adjective" / "adjectives", "number" / "numbers") are merged
 * here instead of in the data.
 */

export type BuzzInCourseId = "beginners" | "intermediate" | "advanced" | "community";

export type BuzzInWeekOption = {
  id: string;
  number: number;
  title: string;
  tags: string[];
  /** Distinct askable questions for this user. */
  count: number;
};

export type BuzzInCourseOption = {
  id: BuzzInCourseId;
  label: string;
  subtitle: string;
  available: boolean;
  weeks: BuzzInWeekOption[];
  /** Every tag in the course, for the Mixed tab. */
  allTags: string[];
  mixedCount: number;
};

export type BuzzInThemeOption = {
  id: string;
  label: string;
  tags: string[];
  count: number;
};

export type BuzzInTopicCatalogue = {
  courses: BuzzInCourseOption[];
  themes: BuzzInThemeOption[];
};

/** Fewest distinct questions a pick needs: one right answer plus three wrong ones. */
export const BUZZ_IN_MIN_QUESTIONS = 4;

export type CourseDefinition = {
  id: BuzzInCourseId;
  label: string;
  /** courses.name in the database, used to read lesson titles. */
  dbName: string | null;
  available: boolean;
  weekCount: number;
  /** Tags for week n. */
  tagsForWeek: (n: number) => string[];
  /** Weeks that have no quiz content (e.g. a presentation week). */
  skipWeeks?: number[];
  fallbackTitles?: Record<number, string>;
};

const BEGINNER_CONTENT_WEEKS = Array.from({ length: 10 }, (_, i) => i + 1);

export const BUZZ_IN_COURSES: CourseDefinition[] = [
  {
    id: "beginners",
    label: "Beginners",
    dbName: "Beginners Course",
    available: true,
    weekCount: 12,
    tagsForWeek: (n) =>
      n === 11
        ? [...BEGINNER_CONTENT_WEEKS.map((w) => `week_${w}`), "week11"]
        : [`week_${n}`],
    skipWeeks: [12],
    fallbackTitles: {
      1: "The 6 questions",
      2: "Sentence structure",
      3: "Verb roots and endings",
      4: "Connecting words and ability",
      5: "Verbals",
      6: "Wants and needs",
      7: "Questions, negatives and adjectives",
      8: "Past tense",
      9: "Future tense",
      10: "Imperatives",
      11: "Recap: weeks 1 to 10",
    },
  },
  {
    id: "intermediate",
    label: "Intermediate",
    dbName: "Intermediate Course",
    available: false,
    weekCount: 12,
    tagsForWeek: () => [],
  },
  {
    id: "advanced",
    label: "Advanced",
    dbName: null,
    available: false,
    weekCount: 0,
    tagsForWeek: () => [],
  },
  {
    id: "community",
    label: "Community",
    dbName: "Kidda Community",
    available: true,
    weekCount: 24,
    tagsForWeek: (n) => [`community_week_${n}`],
  },
];

export const BUZZ_IN_THEMES: Array<{ id: string; label: string; tags: string[] }> = [
  { id: "food", label: "Food", tags: ["food"] },
  { id: "family", label: "Family", tags: ["family"] },
  { id: "time", label: "Time", tags: ["time"] },
  { id: "days", label: "Days and dates", tags: ["days_of_week", "days_and_dates", "calendar"] },
  { id: "numbers", label: "Numbers", tags: ["number", "numbers", "ordinal"] },
  { id: "colours", label: "Colours", tags: ["colours"] },
  { id: "clothing", label: "Clothing", tags: ["clothing"] },
  { id: "body", label: "Body", tags: ["body", "body_health"] },
  { id: "animals", label: "Animals", tags: ["animals"] },
  { id: "nature", label: "Nature", tags: ["nature"] },
  { id: "weather", label: "Weather", tags: ["weather"] },
  { id: "home", label: "Home", tags: ["household", "furniture"] },
  { id: "transport", label: "Transport", tags: ["transport"] },
  { id: "places", label: "Places", tags: ["places"] },
  { id: "jobs", label: "Jobs", tags: ["professions"] },
  { id: "school", label: "School", tags: ["school", "schools"] },
  { id: "feelings", label: "Feelings", tags: ["emotions"] },
  { id: "money", label: "Money", tags: ["money"] },
  { id: "actions", label: "Everyday actions", tags: ["everyday_actions", "action"] },
];

/** "Wants & Needs - Week 6" → "Wants and needs". */
export function cleanLessonTitle(raw: string): string {
  const withoutWeek = raw.replace(/\s*[-–—]\s*week\s*\d+\s*$/i, "").trim();
  return withoutWeek.replace(/\s*&\s*/g, " and ").replace(/\s*\+\s*/g, " and ");
}

export type BuzzInSelection =
  | { mode: "week"; courseId: BuzzInCourseId; week: number }
  | { mode: "themes"; themeIds: string[] }
  | { mode: "mixed"; courseId: BuzzInCourseId };

export type ResolvedSelection = { tags: string[]; label: string } | { error: string };

/** Week numbers a course offers in the picker. */
export function courseWeekNumbers(course: CourseDefinition): number[] {
  return Array.from({ length: course.weekCount }, (_, i) => i + 1).filter(
    (n) => !(course.skipWeeks ?? []).includes(n)
  );
}

export function courseAllTags(course: CourseDefinition): string[] {
  return [...new Set(courseWeekNumbers(course).flatMap((n) => course.tagsForWeek(n)))];
}

/**
 * Turn the host's pick into the topic tags and a short label for the game header.
 * Uses only the static definitions, so the server can trust it without re-counting.
 */
export function resolveBuzzInSelection(selection: BuzzInSelection): ResolvedSelection {
  if (selection.mode === "themes") {
    const themes = BUZZ_IN_THEMES.filter((theme) => selection.themeIds.includes(theme.id));
    if (themes.length === 0) return { error: "Pick at least one theme." };
    const tags = [...new Set(themes.flatMap((theme) => theme.tags))];
    const names = themes.map((theme) => theme.label);
    const label =
      names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    return { tags, label };
  }

  const course = BUZZ_IN_COURSES.find((item) => item.id === selection.courseId);
  if (!course || !course.available) return { error: "That course is coming soon." };

  if (selection.mode === "mixed") {
    const tags = courseAllTags(course);
    if (tags.length === 0) return { error: "No questions for that course yet." };
    return { tags, label: `${course.label} mixed` };
  }

  if (!courseWeekNumbers(course).includes(selection.week)) return { error: "Pick a week." };
  const tags = course.tagsForWeek(selection.week);
  return { tags, label: `Week ${selection.week}` };
}

export function parseBuzzInSelection(raw: unknown): BuzzInSelection | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const courseIds: BuzzInCourseId[] = ["beginners", "intermediate", "advanced", "community"];
    const courseId = courseIds.find((id) => id === value.courseId);
    if (value.mode === "week" && courseId && Number.isInteger(value.week)) {
      return { mode: "week", courseId, week: Number(value.week) };
    }
    if (value.mode === "mixed" && courseId) return { mode: "mixed", courseId };
    if (value.mode === "themes" && Array.isArray(value.themeIds)) {
      return {
        mode: "themes",
        themeIds: value.themeIds.map(String).filter((id) => id.length > 0),
      };
    }
    return null;
  } catch {
    return null;
  }
}
