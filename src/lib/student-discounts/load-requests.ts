import type { StudentDiscountRequestRow, StudentDiscountRequestView } from "@/lib/student-discounts/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function toView(row: StudentDiscountRequestRow): StudentDiscountRequestView {
  return {
    id: row.id,
    courseFormat: row.course_format,
    discountType: row.discount_type ?? "student",
    status: row.status,
    discountCode: row.discount_code,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export type StudentDiscountRequestsLoadResult = {
  requests: StudentDiscountRequestView[];
  /** True when the table exists but the read failed (RLS, network, etc.). */
  loadFailed: boolean;
};

export async function loadUserStudentDiscountRequests(
  supabase: SupabaseClient,
  userId: string
): Promise<StudentDiscountRequestsLoadResult> {
  const { data, error } = await supabase
    .from("student_discount_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.toLowerCase().includes("student_discount_requests")) {
      return { requests: [], loadFailed: false };
    }
    return { requests: [], loadFailed: true };
  }

  return {
    requests: ((data ?? []) as StudentDiscountRequestRow[]).map(toView),
    loadFailed: false,
  };
}

export function studentDiscountSchemaReady(errorMessage: string | undefined): boolean {
  if (!errorMessage) return true;
  return !errorMessage.toLowerCase().includes("student_discount_requests");
}
