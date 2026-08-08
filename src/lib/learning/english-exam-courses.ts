/**
 * Life in the UK / UK Driving Theory — exam-style Learn English courses.
 * Identified by course name (no hardcoded IDs). Foundations / Living / Work stay separate.
 */

export type EnglishExamCourseKind = "life_in_uk" | "uk_driving";

export type EnglishExamCourseConfig = {
  kind: EnglishExamCourseKind;
  /** Questions drawn per mock sitting (no repeats within the sitting). */
  mockQuestionCount: number;
  /** Mock time limit in minutes. */
  mockMinutes: number;
  /** Pass mark as percent (e.g. 75). */
  passPercent: number;
  /** Correct answers needed to pass (e.g. 18 of 24). */
  passCorrect: number;
};

export function getEnglishExamCourseConfig(
  courseName: string
): EnglishExamCourseConfig | null {
  const name = courseName.toLowerCase();

  if (name.includes("driving")) {
    return {
      kind: "uk_driving",
      mockQuestionCount: 50,
      mockMinutes: 57,
      passPercent: 86,
      passCorrect: 43,
    };
  }

  if (name.includes("life in the uk") || (name.includes("life") && name.includes("uk"))) {
    return {
      kind: "life_in_uk",
      mockQuestionCount: 24,
      mockMinutes: 45,
      passPercent: 75,
      passCorrect: 18,
    };
  }

  return null;
}

export function isEnglishExamCourse(courseName: string): boolean {
  return getEnglishExamCourseConfig(courseName) != null;
}

export type EnglishExamQuestion = {
  id: string;
  quizId: string;
  quizTitle: string;
  lessonId: string | null;
  lessonNumber: number | null;
  chapterTitle: string;
  questionText: string;
  questionTextPa: string | null;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  optionAPa: string | null;
  optionBPa: string | null;
  optionCPa: string | null;
  optionDPa: string | null;
  correctAnswer: "a" | "b" | "c" | "d";
  explanation: string | null;
  explanationPa: string | null;
  questionOrder: number;
  questionAudioEnUrl: string | null;
  questionAudioPaUrl: string | null;
  imageUrl: string | null;
  imageAttribution: string | null;
};

export type EnglishExamMaterial = {
  id: string;
  title: string;
  lessonNumber: number;
  audioScript: string;
};

export type EnglishLessonSentence = {
  id: string;
  lessonId: string;
  sortOrder: number;
  punjabiText: string;
  romanisedText: string | null;
  englishText: string;
  punjabiAudioUrl: string | null;
  englishAudioUrl: string | null;
  punjabiAudioStatus: string;
  englishAudioStatus: string;
};

export type EnglishChapterScore = {
  lessonId: string;
  chapterTitle: string;
  lessonNumber: number | null;
  correct: number;
  total: number;
  percent: number;
  materialsHref: string;
};
