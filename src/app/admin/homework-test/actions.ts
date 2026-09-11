"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import type { CatchupActionResult } from "@/app/catchup/catchup-actions";
import type { HomeworkActionResult } from "@/app/dashboard/learn/homework-actions";
import type { TextHomeworkAnswer } from "@/lib/catchup/load-segment-questions";
import { courseActorFromHomeworkTestStudent } from "@/lib/admin/homework-test-types";
import {
  loadHomeworkTestCohorts,
  loadHomeworkTestCourses,
  loadHomeworkTestLessons,
  loadHomeworkTestLessonView,
  loadHomeworkTestPreview,
  loadHomeworkTestStudent,
  loadHomeworkTestStudents,
} from "@/lib/admin/load-homework-test";
import { getHomeworkTimingState } from "@/lib/tutoring/homework-near-lesson";
import {
  createHomeworkPlaybackUrl,
  fetchFormalHomeworkForActor,
  homeworkTimingWarningMessage,
} from "@/lib/tutoring/homework-submissions";
import { persistTextHomework, persistVoiceHomework } from "@/lib/tutoring/submit-homework";
import { revalidatePath } from "next/cache";

export type AdminHomeworkSubmitResult = HomeworkActionResult & {
  submissionId?: string;
  storagePath?: string | null;
  appearsInTutorInbox?: boolean;
};

type AdminHomeworkActorInput = {
  lessonId: string;
  cohortId: string;
  studentKey: string;
};

function revalidateAdminHomeworkPaths(lessonId: string) {
  revalidatePath("/admin/homework-test");
  revalidatePath("/dashboard/tutor/homework");
  revalidatePath(`/dashboard/learn/homework/${lessonId}`);
}

export async function loadHomeworkTestBootstrapAction() {
  try {
    const supabase = await requireAdminFromActions();
    const courses = await loadHomeworkTestCourses(supabase);
    return { courses };
  } catch (error) {
    return {
      courses: [],
      error: error instanceof Error ? error.message : "Could not load courses.",
    };
  }
}

export async function loadHomeworkTestLessonsAction(courseId: string) {
  try {
    const supabase = await requireAdminFromActions();
    const lessons = await loadHomeworkTestLessons(supabase, courseId);
    return { lessons };
  } catch (error) {
    return {
      lessons: [],
      error: error instanceof Error ? error.message : "Could not load lessons.",
    };
  }
}

export async function loadHomeworkTestCohortsAction(courseId: string) {
  try {
    const supabase = await requireAdminFromActions();
    const cohorts = await loadHomeworkTestCohorts(supabase, courseId);
    return { cohorts };
  } catch (error) {
    return {
      cohorts: [],
      error: error instanceof Error ? error.message : "Could not load cohorts.",
    };
  }
}

export async function loadHomeworkTestStudentsAction(cohortId: string) {
  try {
    const supabase = await requireAdminFromActions();
    const students = await loadHomeworkTestStudents(supabase, cohortId);
    return { students };
  } catch (error) {
    return {
      students: [],
      error: error instanceof Error ? error.message : "Could not load students.",
    };
  }
}

export async function loadHomeworkTestLessonViewAction(lessonId: string) {
  try {
    const supabase = await requireAdminFromActions();
    const view = await loadHomeworkTestLessonView(supabase, lessonId);
    return { view };
  } catch (error) {
    return {
      view: null,
      error: error instanceof Error ? error.message : "Could not load homework.",
    };
  }
}

export async function loadHomeworkTestPreviewAction(
  lessonId: string,
  cohortId: string,
  studentKey: string
) {
  try {
    const supabase = await requireAdminFromActions();
    const preview = await loadHomeworkTestPreview(supabase, {
      lessonId,
      cohortId,
      studentKey,
    });
    return { preview };
  } catch (error) {
    return {
      preview: null,
      error: error instanceof Error ? error.message : "Could not load homework.",
    };
  }
}

export async function getAdminHomeworkPlaybackUrl(
  storagePath: string
): Promise<HomeworkActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const playbackUrl = await createHomeworkPlaybackUrl(supabase, storagePath);
    if (!playbackUrl) return { error: "Could not load audio." };
    return { playbackUrl };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load audio." };
  }
}

export async function getAdminHomeworkNearLessonWarning(
  lessonId: string,
  studentId: string | null,
  kidProfileId: string | null
): Promise<HomeworkActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    if (!studentId && !kidProfileId) {
      return { nearLessonWarning: null, timingState: null };
    }
    const state = await getHomeworkTimingState(
      supabase,
      studentId ?? kidProfileId ?? "",
      lessonId,
      new Date(),
      kidProfileId
    );
    return {
      nearLessonWarning: homeworkTimingWarningMessage(state),
      timingState: state,
    };
  } catch {
    return { nearLessonWarning: null, timingState: null };
  }
}

async function resolveAdminHomeworkActor(input: AdminHomeworkActorInput) {
  const supabase = await requireAdminFromActions();
  const student = await loadHomeworkTestStudent(
    supabase,
    input.cohortId,
    input.studentKey
  );
  if (!student) {
    return { error: "Student is not in this cohort." as const };
  }
  return {
    supabase,
    student,
    actor: courseActorFromHomeworkTestStudent(student),
  };
}

export async function submitAdminHomeworkRecording(
  input: AdminHomeworkActorInput,
  formData: FormData
): Promise<AdminHomeworkSubmitResult> {
  try {
    const resolved = await resolveAdminHomeworkActor(input);
    if ("error" in resolved) return { error: resolved.error };

    const file = formData.get("audio");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "Please record your homework before submitting." };
    }

    const durationRaw = formData.get("duration_seconds");
    const durationSeconds =
      typeof durationRaw === "string" && durationRaw.trim()
        ? Number.parseInt(durationRaw, 10)
        : null;

    const persisted = await persistVoiceHomework({
      supabase: resolved.supabase,
      actor: resolved.actor,
      lessonId: input.lessonId,
      file,
      durationSeconds,
    });
    if ("error" in persisted) return { error: persisted.error };

    const submission = await fetchFormalHomeworkForActor(
      resolved.supabase,
      resolved.actor,
      input.lessonId
    );

    console.info("[admin homework-test] voice submitted", {
      lessonId: input.lessonId,
      cohortId: input.cohortId,
      studentId: resolved.student.studentId,
      kidProfileId: resolved.student.kidProfileId,
      studentPackageId: resolved.student.studentPackageId,
      submissionId: submission?.id ?? null,
      storagePath: persisted.storagePath,
      isPractice: false,
    });

    revalidateAdminHomeworkPaths(input.lessonId);
    return {
      success: "Homework submitted! It should now appear in the tutor homework inbox.",
      submissionId: submission?.id,
      storagePath: persisted.storagePath,
      appearsInTutorInbox: true,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit homework." };
  }
}

export async function submitAdminHomeworkText(
  input: AdminHomeworkActorInput,
  answers: TextHomeworkAnswer[]
): Promise<AdminHomeworkSubmitResult> {
  try {
    const resolved = await resolveAdminHomeworkActor(input);
    if ("error" in resolved) return { error: resolved.error };

    const persisted = await persistTextHomework({
      supabase: resolved.supabase,
      actor: resolved.actor,
      lessonId: input.lessonId,
      answers,
    });
    if ("error" in persisted) return { error: persisted.error };

    const submission = await fetchFormalHomeworkForActor(
      resolved.supabase,
      resolved.actor,
      input.lessonId
    );

    console.info("[admin homework-test] text submitted", {
      lessonId: input.lessonId,
      cohortId: input.cohortId,
      studentId: resolved.student.studentId,
      kidProfileId: resolved.student.kidProfileId,
      studentPackageId: resolved.student.studentPackageId,
      submissionId: submission?.id ?? null,
      isPractice: false,
    });

    revalidateAdminHomeworkPaths(input.lessonId);
    return {
      success: "Homework submitted! It should now appear in the tutor homework inbox.",
      submissionId: submission?.id,
      storagePath: null,
      appearsInTutorInbox: true,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit homework." };
  }
}

export async function getAdminHomeworkTextNearLessonWarning(
  lessonId: string,
  studentId: string | null,
  kidProfileId: string | null
): Promise<CatchupActionResult> {
  const result = await getAdminHomeworkNearLessonWarning(
    lessonId,
    studentId,
    kidProfileId
  );
  return {
    nearLessonWarning: result.nearLessonWarning ?? null,
    timingState: result.timingState ?? null,
    error: result.error,
  };
}
