"use server";

import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { getDisplayName } from "@/lib/profile/display-name";
import {
  verifiedDiscountCode,
  verifiedDiscountRequestLabel,
  type StudentDiscountCourseFormat,
  type VerifiedDiscountType,
} from "@/lib/student-discounts/constants";
import { STUDENT_DISCOUNT_EVIDENCE_BUCKET } from "@/lib/student-discounts/storage";
import type { AdminStudentDiscountRequest, StudentDiscountRequestRow } from "@/lib/student-discounts/types";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AdminDiscountActionResult = {
  error?: string;
  success?: string;
};

const ADMIN_PATH = "/admin/content/people";
const COURSE_PAGE = "/courses/beginners";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await canAccessAdminPanel(user, supabase))) {
    throw new Error("Unauthorized.");
  }

  return { user, service: createServiceRoleClient() };
}

function withDbHint(message: string): string {
  if (message.toLowerCase().includes("student_discount_requests")) {
    return `${message} Run supabase/student-discount-requests.sql in the Supabase SQL Editor.`;
  }
  return message;
}

export async function loadAdminStudentDiscountRequests(): Promise<{
  requests: AdminStudentDiscountRequest[];
  error?: string;
}> {
  try {
    const { service } = await requireAdmin();

    const { data: rows, error } = await service
      .from("student_discount_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return { requests: [], error: withDbHint(error.message) };
    }

    const typedRows = (rows ?? []) as StudentDiscountRequestRow[];
    if (typedRows.length === 0) return { requests: [] };

    const userIds = [...new Set(typedRows.map((row) => row.user_id))];
    const { data: profiles } = await service
      .from("profiles")
      .select("id, full_name, preferred_name, avatar_url")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [profile.id as string, profile])
    );

    const emailResults = await Promise.all(
      userIds.map(async (userId) => {
        const { data } = await service.auth.admin.getUserById(userId);
        return [userId, data.user?.email ?? null] as const;
      })
    );
    const emailMap = new Map(emailResults);

    const requests: AdminStudentDiscountRequest[] = typedRows.map((row) => {
      const profile = profileMap.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        courseFormat: row.course_format,
        discountType: row.discount_type ?? "student",
        status: row.status,
        discountCode: row.discount_code,
        adminNotes: row.admin_notes,
        createdAt: row.created_at,
        reviewedAt: row.reviewed_at,
        storagePath: row.storage_path,
        mimeType: row.mime_type,
        studentName: getDisplayName(profile) || "Learner",
        studentEmail: emailMap.get(row.user_id) ?? null,
      };
    });

    return { requests };
  } catch (e) {
    return {
      requests: [],
      error: e instanceof Error ? e.message : "Could not load student discount requests.",
    };
  }
}

export async function getStudentDiscountEvidenceUrl(
  storagePath: string
): Promise<AdminDiscountActionResult & { url?: string }> {
  try {
    const { service } = await requireAdmin();

    const { data, error } = await service.storage
      .from(STUDENT_DISCOUNT_EVIDENCE_BUCKET)
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      return { error: error?.message ?? "Could not load evidence file." };
    }

    return { url: data.signedUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not load evidence file." };
  }
}

async function notifyStudent(
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  type: "student_discount_approved" | "student_discount_rejected",
  payload: Record<string, unknown>
) {
  await service.from("notifications").insert({
    user_id: userId,
    type,
    payload,
  });
}

export async function reviewStudentDiscountRequest(
  requestId: string,
  decision: "approved" | "rejected",
  adminNotes: string | null,
  customDiscountCode: string | null
): Promise<AdminDiscountActionResult> {
  try {
    const { user, service } = await requireAdmin();

    const { data: row, error: loadError } = await service
      .from("student_discount_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (loadError) return { error: withDbHint(loadError.message) };
    if (!row) return { error: "Request not found." };

    const typedRow = row as StudentDiscountRequestRow;
    if (typedRow.status !== "pending") {
      return { error: "This request has already been reviewed." };
    }

    let discountCode: string | null = null;
    if (decision === "approved") {
      const format = typedRow.course_format as StudentDiscountCourseFormat;
      const type = (typedRow.discount_type ?? "student") as VerifiedDiscountType;
      discountCode = customDiscountCode?.trim() || verifiedDiscountCode(format, type);

      if (!discountCode) {
        return {
          error:
            "No discount code configured for this application type. Set the matching Stripe promo code env var, or enter a code manually.",
        };
      }
    }

    const { error: updateError } = await service
      .from("student_discount_requests")
      .update({
        status: decision,
        discount_code: discountCode,
        admin_notes: adminNotes?.trim() || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateError) return { error: withDbHint(updateError.message) };

    const requestLabel = verifiedDiscountRequestLabel(
      typedRow.course_format as StudentDiscountCourseFormat,
      (typedRow.discount_type ?? "student") as VerifiedDiscountType
    );

    if (decision === "approved") {
      await notifyStudent(service, typedRow.user_id, "student_discount_approved", {
        request_id: requestId,
        course_format: typedRow.course_format,
        discount_type: typedRow.discount_type ?? "student",
        request_label: requestLabel,
        discount_code: discountCode,
      });
    } else {
      await notifyStudent(service, typedRow.user_id, "student_discount_rejected", {
        request_id: requestId,
        course_format: typedRow.course_format,
        discount_type: typedRow.discount_type ?? "student",
        request_label: requestLabel,
        admin_notes: adminNotes?.trim() || null,
      });
    }

    revalidatePath(ADMIN_PATH);
    revalidatePath(COURSE_PAGE);
    return {
      success:
        decision === "approved"
          ? `Approved — ${requestLabel} discount code sent.`
          : "Application rejected.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not review request." };
  }
}
