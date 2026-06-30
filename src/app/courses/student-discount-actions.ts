"use server";

import type {
  StudentDiscountCourseFormat,
  VerifiedDiscountType,
} from "@/lib/student-discounts/constants";
import {
  STUDENT_DISCOUNT_EVIDENCE_BUCKET,
  studentDiscountEvidencePath,
  validateStudentDiscountEvidence,
} from "@/lib/student-discounts/storage";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type StudentDiscountActionResult = {
  error?: string;
  success?: string;
};

const COURSE_PAGE = "/courses/beginners";

function parseCourseFormat(value: FormDataEntryValue | null): StudentDiscountCourseFormat | null {
  if (value === "group" || value === "one_to_one") return value;
  return null;
}

function parseDiscountType(value: FormDataEntryValue | null): VerifiedDiscountType | null {
  if (value === "student" || value === "bluelight") return value;
  return null;
}

function withDbHint(message: string): string {
  if (message.toLowerCase().includes("student_discount_requests")) {
    return `${message} Run supabase/student-discount-requests.sql and student-discount-discount-type.sql in the Supabase SQL Editor.`;
  }
  return message;
}

export async function submitStudentDiscountRequest(
  formData: FormData
): Promise<StudentDiscountActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Please sign in to apply for a student or Blue Light discount." };
    }

    const courseFormat = parseCourseFormat(formData.get("course_format"));
    if (!courseFormat) {
      return { error: "Please choose group or 1-to-1." };
    }

    const discountType = parseDiscountType(formData.get("discount_type"));
    if (!discountType) {
      return { error: "Please choose student or Blue Light discount." };
    }

    const file = formData.get("evidence");
    if (!(file instanceof File) || file.size === 0) {
      return {
        error:
          discountType === "bluelight"
            ? "Please upload your Blue Light Card."
            : "Please upload your student ID or proof of enrolment.",
      };
    }

    const validationError = validateStudentDiscountEvidence(file);
    if (validationError) return { error: validationError };

    const { data: existing } = await supabase
      .from("student_discount_requests")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("course_format", courseFormat)
      .eq("discount_type", discountType)
      .maybeSingle();

    if (existing?.status === "pending") {
      return { error: "You already have a pending application for this option." };
    }

    if (existing?.status === "approved") {
      return { error: "Your discount for this option is already approved." };
    }

    const requestId = existing?.id ?? crypto.randomUUID();
    const storagePath = studentDiscountEvidencePath(user.id, requestId, file);

    const { error: uploadError } = await supabase.storage
      .from(STUDENT_DISCOUNT_EVIDENCE_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return { error: withDbHint(uploadError.message) };
    }

    if (existing?.status === "rejected") {
      const { error: updateError } = await supabase
        .from("student_discount_requests")
        .update({
          status: "pending",
          storage_path: storagePath,
          mime_type: file.type,
          discount_code: null,
          admin_notes: null,
          reviewed_by: null,
          reviewed_at: null,
        })
        .eq("id", existing.id)
        .eq("user_id", user.id);

      if (updateError) return { error: withDbHint(updateError.message) };
    } else {
      const { error: insertError } = await supabase.from("student_discount_requests").insert({
        id: requestId,
        user_id: user.id,
        course_format: courseFormat,
        discount_type: discountType,
        status: "pending",
        storage_path: storagePath,
        mime_type: file.type,
      });

      if (insertError) return { error: withDbHint(insertError.message) };
    }

    revalidatePath(COURSE_PAGE);
    return {
      success:
        "Application submitted. We'll review your evidence and notify you when your discount is ready.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not submit application." };
  }
}
