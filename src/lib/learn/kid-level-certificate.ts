import { LEARN_COURSE_LEVELS } from "@/lib/learn/course-levels";

export type CertificateStage = "beginner" | "intermediate" | "advanced";

export type KidLevelCertificateCandidate = {
  enrollmentId: string;
  kidProfileId: string;
  kidName: string;
  levelNumber: number;
  certificateStage: CertificateStage;
  alreadyIssued: boolean;
};

export type KidLevelCompletePlan = {
  completedLevel: 1 | 2 | 3;
  nextLevel: 1 | 2 | 3;
  incrementLevel: boolean;
  finishedStageCap: boolean;
};

export function certificateStageForCourse(course: {
  content_track?: string | null;
  required_tier?: string | null;
  name?: string | null;
}): CertificateStage | null {
  const track = course.content_track?.trim().toLowerCase() ?? "";
  const tier = course.required_tier?.trim().toLowerCase() ?? "";
  const name = course.name ?? "";

  if (tier === "intermediate") return "intermediate";
  if (tier === "advanced") return "advanced";
  if (track === "kids" || tier === "beginners" || /kids.*beginner/i.test(name)) {
    return "beginner";
  }
  return null;
}

export function cefrForCertificateStage(stage: CertificateStage): string {
  if (stage === "beginner") return LEARN_COURSE_LEVELS.beginners.cefr;
  if (stage === "intermediate") return LEARN_COURSE_LEVELS.intermediate.cefr;
  return LEARN_COURSE_LEVELS.advanced.cefr;
}

export function planKidLevelComplete(currentLevel: number): KidLevelCompletePlan | null {
  if (currentLevel !== 1 && currentLevel !== 2 && currentLevel !== 3) return null;

  const finishedStageCap = currentLevel === 3;
  return {
    completedLevel: currentLevel,
    nextLevel: finishedStageCap ? 3 : ((currentLevel + 1) as 2 | 3),
    incrementLevel: !finishedStageCap,
    finishedStageCap,
  };
}
