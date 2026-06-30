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

export async function loadUserStudentDiscountRequests(
  supabase: SupabaseClient,
  userId: string
): Promise<StudentDiscountRequestView[]> {
  const { data, error } = await supabase
    .from("student_discount_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.message.toLowerCase().includes("student_discount_requests")) {
      return [];
    }
    throw error;
  }

  return ((data ?? []) as StudentDiscountRequestRow[]).map(toView);
}

export function studentDiscountSchemaReady(errorMessage: string | undefined): boolean {
  if (!errorMessage) return true;
  return !errorMessage.toLowerCase().includes("student_discount_requests");
}
