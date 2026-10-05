import { isFoundationalCourse, lessonSlotLabel } from "@/lib/tutoring/log-lesson-copy";

export type ClassIssue = {
  tone: "red" | "amber" | "green";
  label: string;
};

export function classIssue(options: {
  courseName: string;
  missingRecordingNumber: number | null;
  missingHomeworkNumber: number | null;
}): ClassIssue {
  if (options.missingRecordingNumber != null) {
    return {
      tone: "red",
      label: `${lessonSlotLabel(options.courseName, options.missingRecordingNumber)} recording missing`,
    };
  }
  if (options.missingHomeworkNumber != null) {
    return {
      tone: "amber",
      label: `${lessonSlotLabel(options.courseName, options.missingHomeworkNumber)} homework not submitted`,
    };
  }
  return { tone: "green", label: "Up to date" };
}

export function classTypePill(options: {
  kind: "group" | "one_to_one";
  name: string;
  courseName: string;
}): string {
  if (options.kind === "group") {
    const match = options.name.match(/(\d+)/);
    return match ? `GROUP · ${match[1]}` : "GROUP";
  }
  const course = isFoundationalCourse(options.courseName)
    ? "FOUNDATIONAL"
    : (options.courseName.split(/\s+/)[0] ?? "COURSE").toUpperCase();
  return `1-1 · ${course}`;
}

export function lowestLessonNumber(
  lessons: Array<{ lessonNumber: number; flagged: boolean }>
): number | null {
  const flagged = lessons.filter((lesson) => lesson.flagged).sort((a, b) => a.lessonNumber - b.lessonNumber);
  return flagged[0]?.lessonNumber ?? null;
}
