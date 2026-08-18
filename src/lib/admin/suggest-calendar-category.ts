import { titleContainsName } from "@/lib/calendar/match-events";
import type {
  TutorCohortMatchCandidate,
  TutorStudentMatchCandidate,
} from "@/lib/calendar/match-events";
import type { KiddaWorkCategory } from "@/lib/calendar/event-tags";

export type ReviewCategory = KiddaWorkCategory | "personal" | "lesson_needs_matching";

export const REVIEW_CATEGORY_LABELS: Record<ReviewCategory, string> = {
  lesson_needs_matching: "Looks like a lesson (needs matching)",
  kidda_meeting: "Kidda meeting",
  kidda_admin: "Kidda admin",
  kidda_prep: "Kidda prep",
  personal: "Personal",
};

export type CategorySuggestion = {
  category: ReviewCategory;
  reason: string;
};

function looksLikeTitleNameMatch(
  title: string,
  students: TutorStudentMatchCandidate[],
  cohorts: TutorCohortMatchCandidate[]
): { matched: boolean; label: string | null } {
  const student = students.find((entry) => titleContainsName(title, entry.displayName));
  if (student) return { matched: true, label: student.displayName };
  const cohort = cohorts.find((entry) => titleContainsName(title, entry.cohortName));
  if (cohort) return { matched: true, label: cohort.cohortName };
  return { matched: false, label: null };
}

export function suggestCalendarCategory(
  title: string,
  options: {
    students: TutorStudentMatchCandidate[];
    cohorts: TutorCohortMatchCandidate[];
    isRecurring: boolean;
  }
): CategorySuggestion {
  const text = title.trim();
  const lower = text.toLowerCase();
  const nameMatch = looksLikeTitleNameMatch(text, options.students, options.cohorts);

  if (nameMatch.matched) {
    return {
      category: "lesson_needs_matching",
      reason: `Title matches enrolled ${nameMatch.label} (same rule as calendar title-name matching)${
        options.isRecurring ? " · recurring" : ""
      }`,
    };
  }

  if (
    /\b(gym|workout|lunch|dinner|breakfast|brunch|night routine|out of office|ooo|holiday|vacation|birthday|dentist|haircut|personal)\b/i.test(
      lower
    )
  ) {
    return { category: "personal", reason: "Title looks like personal time" };
  }

  if (/\b(meeting|standup|stand-up|all[- ]hands|team sync)\b/i.test(lower)) {
    return { category: "kidda_meeting", reason: "Title looks like a Kidda meeting" };
  }

  if (/\b(prep|planning)\b/i.test(lower)) {
    return { category: "kidda_prep", reason: "Title looks like prep / planning" };
  }

  if (/\b(admin|commute|blocked|catch ?up)\b/i.test(lower)) {
    return { category: "kidda_admin", reason: "Title looks like admin / buffer time" };
  }

  if (
    /\b(1-?to-?1|1-1|1:1|beginner|foundational|cohort|punjabi (course|class|lesson)|kidda class|lesson)\b/i.test(
      lower
    )
  ) {
    return {
      category: "lesson_needs_matching",
      reason: `Title looks like a teaching session that calendar matching missed${
        options.isRecurring ? " · recurring" : ""
      }`,
    };
  }

  return {
    category: "personal",
    reason: "No Kidda teaching or meeting signal in the title",
  };
}
