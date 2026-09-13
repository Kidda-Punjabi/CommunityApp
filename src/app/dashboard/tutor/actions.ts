"use server";

import { createClient } from "@/lib/supabase/server";
import { canAccessTutorDashboard, canManageCohort } from "@/lib/tutoring/tutor-access";
import { isMasterAdmin } from "@/lib/auth/admin-access";
import {
  cefrForCertificateStage,
  certificateStageForCourse,
  planKidLevelComplete,
} from "@/lib/learn/kid-level-certificate";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { revalidatePath } from "next/cache";

export type TutorActionResult = {
  error?: string;
  success?: string;
};

function revalidateTutorPaths() {
  revalidatePath("/dashboard/tutor");
  revalidatePath("/dashboard/tutor/attendance");
  revalidatePath("/dashboard/tutor/homework");
  revalidatePath("/dashboard/tutor/lessons");
  revalidatePath("/dashboard/tutor/profile");
  revalidatePath("/dashboard/tutor/student", "layout");
  revalidatePath("/dashboard/tutor/cohort", "layout");
  revalidatePath("/dashboard/learn");
}

async function requireTutorAction(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("You must be signed in.");

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) throw new Error("Tutor access required.");

  return { supabase, userId: user.id };
}

function normalizeRecordingUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export async function setStudentLessonUnlock(
  studentId: string,
  courseId: string,
  lessonId: string,
  unlocked: boolean
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();

    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("tutor_id", userId)
      .eq("user_id", studentId)
      .eq("course_id", courseId)
      .or("delivery_mode.is.null,delivery_mode.eq.one_to_one")
      .maybeSingle();

    if (!enrollment) {
      return { error: "You are not the tutor for this student in this course." };
    }

    if (unlocked) {
      const { error } = await supabase.from("student_lesson_unlocks").upsert(
        {
          student_id: studentId,
          lesson_id: lessonId,
          unlocked_by: userId,
          unlocked_at: new Date().toISOString(),
        },
        { onConflict: "student_id,lesson_id" }
      );
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("student_lesson_unlocks")
        .delete()
        .eq("student_id", studentId)
        .eq("lesson_id", lessonId);
      if (error) return { error: error.message };
    }

    revalidateTutorPaths();
    return { success: unlocked ? "Lesson unlocked." : "Lesson locked." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update unlock." };
  }
}

export async function setCohortLessonUnlock(
  cohortId: string,
  lessonId: string,
  unlocked: boolean
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();

    if (!(await canManageCohort(supabase, userId, cohortId))) {
      return { error: "You are not the tutor for this cohort." };
    }

    if (unlocked) {
      const { error } = await supabase.from("cohort_lesson_unlocks").upsert(
        {
          cohort_id: cohortId,
          lesson_id: lessonId,
          unlocked_by: userId,
          unlocked_at: new Date().toISOString(),
        },
        { onConflict: "cohort_id,lesson_id" }
      );
      if (error) return { error: error.message };
    } else {
      const { error } = await supabase
        .from("cohort_lesson_unlocks")
        .delete()
        .eq("cohort_id", cohortId)
        .eq("lesson_id", lessonId);
      if (error) return { error: error.message };
    }

    revalidateTutorPaths();
    return { success: unlocked ? "Lesson unlocked for cohort." : "Lesson locked for cohort." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update unlock." };
  }
}

export async function saveStudentLessonRecording(
  studentId: string,
  courseId: string,
  lessonId: string,
  recordingUrl: string,
  title?: string
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();
    const url = normalizeRecordingUrl(recordingUrl);
    if (!url) return { error: "Enter a valid http(s) recording link." };

    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("tutor_id", userId)
      .eq("user_id", studentId)
      .eq("course_id", courseId)
      .or("delivery_mode.is.null,delivery_mode.eq.one_to_one")
      .maybeSingle();

    if (!enrollment) {
      return { error: "You are not the tutor for this student in this course." };
    }

    const { data: existing } = await supabase
      .from("lesson_recordings")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("student_id", studentId)
      .maybeSingle();

    const payload = {
      lesson_id: lessonId,
      student_id: studentId,
      cohort_id: null,
      storage_path: url,
      title: title?.trim() || null,
      uploaded_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("lesson_recordings").update(payload).eq("id", existing.id)
      : await supabase.from("lesson_recordings").insert(payload);

    if (error) return { error: error.message };

    revalidateTutorPaths();
    return { success: "Recording link saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save recording." };
  }
}

export async function saveCohortLessonRecording(
  cohortId: string,
  lessonId: string,
  recordingUrl: string,
  title?: string
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();
    const url = normalizeRecordingUrl(recordingUrl);
    if (!url) return { error: "Enter a valid http(s) recording link." };

    if (!(await canManageCohort(supabase, userId, cohortId))) {
      return { error: "You are not the tutor for this cohort." };
    }

    const { data: existing } = await supabase
      .from("lesson_recordings")
      .select("id")
      .eq("lesson_id", lessonId)
      .eq("cohort_id", cohortId)
      .maybeSingle();

    const payload = {
      lesson_id: lessonId,
      student_id: null,
      cohort_id: cohortId,
      storage_path: url,
      title: title?.trim() || null,
      uploaded_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = existing
      ? await supabase.from("lesson_recordings").update(payload).eq("id", existing.id)
      : await supabase.from("lesson_recordings").insert(payload);

    if (error) return { error: error.message };

    revalidateTutorPaths();
    return { success: "Recording link saved for cohort." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save recording." };
  }
}

export async function removeStudentLessonRecording(
  studentId: string,
  lessonId: string
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();

    const { data: enrollment } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("tutor_id", userId)
      .eq("user_id", studentId)
      .limit(1)
      .maybeSingle();

    if (!enrollment) return { error: "Not authorized." };

    const { error } = await supabase
      .from("lesson_recordings")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("student_id", studentId);

    if (error) return { error: error.message };

    revalidateTutorPaths();
    return { success: "Recording removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove recording." };
  }
}

export async function removeCohortLessonRecording(
  cohortId: string,
  lessonId: string
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();

    if (!(await canManageCohort(supabase, userId, cohortId))) {
      return { error: "Not authorized." };
    }

    const { error } = await supabase
      .from("lesson_recordings")
      .delete()
      .eq("lesson_id", lessonId)
      .eq("cohort_id", cohortId);

    if (error) return { error: error.message };

    revalidateTutorPaths();
    return { success: "Recording removed." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to remove recording." };
  }
}

export async function issueKidLevelCertificate(
  enrollmentId: string
): Promise<TutorActionResult> {
  try {
    const { supabase, userId } = await requireTutorAction();

    const { data: enrollment, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .select(
        "id, kid_profile_id, tutor_id, cohort_id, level_number, course_id, courses(name, content_track, required_tier)"
      )
      .eq("id", enrollmentId)
      .maybeSingle();

    if (enrollmentError) return { error: enrollmentError.message };
    if (!enrollment?.kid_profile_id) {
      return { error: "Pick a kid enrolled in this course." };
    }

    const admin = await isMasterAdmin(userId, supabase);
    const managesCohort = enrollment.cohort_id
      ? await canManageCohort(supabase, userId, enrollment.cohort_id)
      : false;
    if (!admin && !managesCohort && enrollment.tutor_id !== userId) {
      return { error: "You are not the tutor for this student." };
    }

    const course = Array.isArray(enrollment.courses)
      ? enrollment.courses[0]
      : enrollment.courses;
    const stage = certificateStageForCourse({
      content_track: course?.content_track,
      required_tier: course?.required_tier,
      name: course?.name,
    });
    if (!stage) {
      return { error: "This course does not map to a certificate stage yet." };
    }

    const plan = planKidLevelComplete(Number(enrollment.level_number));
    if (!plan) {
      return { error: "This enrolment has no Level 1–3 to complete." };
    }

    const { data: existing } = await supabase
      .from("certificates")
      .select("id")
      .eq("kid_profile_id", enrollment.kid_profile_id)
      .eq("level", stage)
      .eq("kid_level_number", plan.completedLevel)
      .maybeSingle();

    if (existing) {
      return {
        error: `A ${stage} Level ${plan.completedLevel} certificate is already issued for this child.`,
      };
    }

    const { data: kid } = await supabase
      .from("kid_profiles")
      .select("name")
      .eq("id", enrollment.kid_profile_id)
      .maybeSingle();
    const kidName = kid?.name?.trim() || "this child";

    const { error: insertError } = await supabase.from("certificates").insert({
      profile_id: null,
      kid_profile_id: enrollment.kid_profile_id,
      level: stage,
      kid_level_number: plan.completedLevel,
      cefr_level: cefrForCertificateStage(stage),
      issued_by: userId,
      course_enrollment_id: enrollment.id,
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return {
          error: `A ${stage} Level ${plan.completedLevel} certificate is already issued for this child.`,
        };
      }
      return { error: insertError.message };
    }

    if (plan.incrementLevel) {
      const { data: updated, error: updateError } = await supabase
        .from("course_enrollments")
        .update({ level_number: plan.nextLevel })
        .eq("id", enrollment.id)
        .eq("level_number", plan.completedLevel)
        .select("id");

      if (updateError || !updated?.length) {
        const { client } = tryCreateServiceRoleClient();
        if (client && (admin || managesCohort)) {
          const { error: adminUpdateError } = await client
            .from("course_enrollments")
            .update({ level_number: plan.nextLevel })
            .eq("id", enrollment.id)
            .eq("level_number", plan.completedLevel);
          if (adminUpdateError) return { error: adminUpdateError.message };
        } else {
          return {
            error:
              updateError?.message ??
              "Certificate issued, but the enrolment level could not be updated.",
          };
        }
      }
    }

    revalidateTutorPaths();
    revalidatePath("/dashboard/learn/certificates");
    revalidatePath("/dashboard/learn/kids-progress", "layout");
    revalidatePath("/dashboard/home");
    revalidatePath("/dashboard/learn/kids", "layout");

    const stageLabel =
      stage === "beginner" ? "Beginner" : stage === "intermediate" ? "Intermediate" : "Advanced";

    if (plan.finishedStageCap) {
      return {
        success: `Issued ${stageLabel} Level ${plan.completedLevel} for ${kidName}. They stay on Level 3 — Intermediate is not a course yet, so the enrolment was not incremented.`,
      };
    }

    return {
      success: `Issued ${stageLabel} Level ${plan.completedLevel} for ${kidName}. They’re now on Level ${plan.nextLevel}.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to issue certificate." };
  }
}
