"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import {
  COHORT_CHANGE_FEE_STATUSES,
  COHORT_CHANGE_STATUSES,
  loadAdminCohortChangeRequest,
  loadAdminCohortChangeRequests,
  loadAdminCourses,
  loadStudentCourseEnrollments,
} from "@/lib/admin/load-admin-cohort-change-requests";
import type {
  CohortChangeFeeStatus,
  CohortChangeRequestStatus,
} from "@/lib/admin/cohort-change-request-types";
import { revalidatePath } from "next/cache";

const PATH = "/admin/cohort-change-requests";

function withSchemaHint(message: string): string {
  if (
    message.includes("cohort_change_requests") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  ) {
    return `${message} Run supabase/cohort-change-requests.sql in the Supabase SQL Editor, then retry.`;
  }
  return message;
}

function parseFeeAmount(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function asStatus(value: string): CohortChangeRequestStatus | null {
  return (COHORT_CHANGE_STATUSES as readonly string[]).includes(value)
    ? (value as CohortChangeRequestStatus)
    : null;
}

function asFeeStatus(value: string): CohortChangeFeeStatus | null {
  return (COHORT_CHANGE_FEE_STATUSES as readonly string[]).includes(value)
    ? (value as CohortChangeFeeStatus)
    : null;
}

export async function fetchAdminCohortChangeRequests() {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminCohortChangeRequests(supabase);
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load cohort switch requests.",
    };
  }
}

export async function fetchAdminCohortChangeRequest(requestId: string) {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminCohortChangeRequest(supabase, requestId);
  } catch (e) {
    return {
      row: null,
      error: e instanceof Error ? e.message : "Failed to load request.",
    };
  }
}

export async function fetchAdminCoursesForCohortChange() {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminCourses(supabase);
  } catch (e) {
    return {
      courses: [],
      error: e instanceof Error ? e.message : "Failed to load courses.",
    };
  }
}

export async function fetchStudentCourseEnrollments(studentId: string) {
  try {
    const supabase = await requireAdminFromActions();
    return loadStudentCourseEnrollments(supabase, studentId);
  } catch (e) {
    return {
      enrollments: [],
      error: e instanceof Error ? e.message : "Failed to load enrollments.",
    };
  }
}

export async function createAdminCohortChangeRequest(input: {
  studentId: string;
  fromCourseId: string;
  toCourseId: string;
  courseEnrollmentId?: string | null;
  reason?: string;
  feeAmount?: string | number | null;
  feeStatus?: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const studentId = input.studentId.trim();
    const fromCourseId = input.fromCourseId.trim();
    const toCourseId = input.toCourseId.trim();
    if (!studentId) return { error: "Select a student." };
    if (!fromCourseId || !toCourseId) return { error: "Select both the current course and the destination course." };
    if (fromCourseId === toCourseId) {
      return { error: "From course and to course must be different." };
    }

    const feeStatus = asFeeStatus(input.feeStatus ?? "unpaid") ?? "unpaid";
    const feeAmount = parseFeeAmount(input.feeAmount);
    const courseEnrollmentId = input.courseEnrollmentId?.trim() || null;

    if (courseEnrollmentId) {
      const { data: enrollment, error: enrollmentError } = await supabase
        .from("course_enrollments")
        .select("id, user_id, course_id")
        .eq("id", courseEnrollmentId)
        .maybeSingle();
      if (enrollmentError || !enrollment) return { error: "Enrollment not found." };
      if (enrollment.user_id !== studentId) {
        return { error: "Enrollment does not belong to this student." };
      }
      if (enrollment.course_id !== fromCourseId) {
        return { error: "Enrollment does not match the from course." };
      }
    }

    const { data, error } = await supabase
      .from("cohort_change_requests")
      .insert({
        student_id: studentId,
        from_course_id: fromCourseId,
        to_course_id: toCourseId,
        course_enrollment_id: courseEnrollmentId,
        reason: input.reason?.trim() || null,
        fee_amount: feeAmount,
        fee_status: feeStatus,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) return { error: withSchemaHint(error.message) };

    revalidatePath(PATH);
    revalidatePath("/admin");
    return { success: "Request logged.", id: data.id as string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create request." };
  }
}

export async function updateAdminCohortChangeRequest(input: {
  requestId: string;
  status: string;
  feeStatus: string;
  adminNotes?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const auth = await createClient();
    const {
      data: { user: adminUser },
    } = await auth.auth.getUser();
    if (!adminUser) return { error: "Unauthorized" };

    const status = asStatus(input.status);
    const feeStatus = asFeeStatus(input.feeStatus);
    if (!status) return { error: "Invalid status." };
    if (!feeStatus) return { error: "Invalid fee status." };

    const { data: existing, error: existingError } = await supabase
      .from("cohort_change_requests")
      .select("id, status, resolved_at, resolved_by")
      .eq("id", input.requestId)
      .maybeSingle();

    if (existingError || !existing) return { error: "Request not found." };

    const leavingPending = existing.status === "pending" && status !== "pending";
    const returningPending = existing.status !== "pending" && status === "pending";

    const { error } = await supabase
      .from("cohort_change_requests")
      .update({
        status,
        fee_status: feeStatus,
        admin_notes: input.adminNotes?.trim() || null,
        resolved_at: returningPending
          ? null
          : leavingPending
            ? new Date().toISOString()
            : existing.resolved_at,
        resolved_by: returningPending
          ? null
          : leavingPending
            ? adminUser.id
            : existing.resolved_by,
      })
      .eq("id", input.requestId);

    if (error) return { error: withSchemaHint(error.message) };

    revalidatePath(PATH);
    revalidatePath(`${PATH}/${input.requestId}`);
    revalidatePath("/admin");
    return {
      success:
        status === "completed"
          ? "Marked completed. Enrollment was not changed — update course enrollments separately if needed."
          : "Request updated.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update request." };
  }
}
