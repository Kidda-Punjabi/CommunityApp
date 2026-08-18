import type { AdminData } from "@/app/admin/content/types";

export type AdminDataSlice = "full" | "core" | "curriculum" | "site";

export function mergeAdminDataSlice(
  prev: AdminData,
  next: AdminData,
  slice: AdminDataSlice
): AdminData {
  if (slice === "full") {
    return next;
  }

  if (slice === "core") {
    return {
      ...prev,
      enrollments: next.enrollments,
      cohorts: next.cohorts,
      staffMembers: next.staffMembers,
      errors: {
        ...prev.errors,
        enrollments: next.errors?.enrollments,
        cohorts: next.errors?.cohorts,
        staffMembers: next.errors?.staffMembers,
      },
    };
  }

  if (slice === "curriculum") {
    return {
      ...prev,
      courses: next.courses,
      lessons: next.lessons,
      quizzes: next.quizzes,
      questions: next.questions,
      flashcardSets: next.flashcardSets,
      setCourseLinks: next.setCourseLinks,
      flashcards: next.flashcards,
      grammarSentences: next.grammarSentences,
      verbConjugations: next.verbConjugations,
      genderedNouns: next.genderedNouns,
      errors: {
        ...prev.errors,
        courses: next.errors?.courses,
        lessons: next.errors?.lessons,
        quizzes: next.errors?.quizzes,
        questions: next.errors?.questions,
        flashcardSets: next.errors?.flashcardSets,
        setCourseLinks: next.errors?.setCourseLinks,
        flashcards: next.errors?.flashcards,
        grammarSentences: next.errors?.grammarSentences,
        verbConjugations: next.errors?.verbConjugations,
        genderedNouns: next.errors?.genderedNouns,
      },
    };
  }

  if (slice === "site") {
    return {
      ...prev,
      events: next.events,
      recommendedMedia: next.recommendedMedia,
      recommendedRecipes: next.recommendedRecipes,
      errors: {
        ...prev.errors,
        events: next.errors?.events,
        recommendedMedia: next.errors?.recommendedMedia,
        recommendedRecipes: next.errors?.recommendedRecipes,
      },
    };
  }

  return prev;
}
