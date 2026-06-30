export const STUDENT_DISCOUNT_EVIDENCE_BUCKET = "student-discount-evidence";

export type StudentDiscountCourseFormat = "group" | "one_to_one";

export type VerifiedDiscountType = "student" | "bluelight";

export type StudentDiscountStatus = "pending" | "approved" | "rejected";

export const VERIFIED_DISCOUNT_SECTION_TITLE = "Student & Blue Light discount";

export const STUDENT_DISCOUNT_FORMAT_LABELS: Record<StudentDiscountCourseFormat, string> = {
  group: "Group course",
  one_to_one: "1-to-1 course",
};

export const VERIFIED_DISCOUNT_TYPE_LABELS: Record<VerifiedDiscountType, string> = {
  student: "Student",
  bluelight: "Blue Light",
};

export function verifiedDiscountCode(
  format: StudentDiscountCourseFormat,
  type: VerifiedDiscountType
): string | null {
  const envKeys: Record<VerifiedDiscountType, Record<StudentDiscountCourseFormat, string>> = {
    student: {
      group: "STRIPE_STUDENT_DISCOUNT_CODE_BEGINNERS_GROUP",
      one_to_one: "STRIPE_STUDENT_DISCOUNT_CODE_BEGINNERS_ONE_TO_ONE",
    },
    bluelight: {
      group: "STRIPE_BLUELIGHT_DISCOUNT_CODE_BEGINNERS_GROUP",
      one_to_one: "STRIPE_BLUELIGHT_DISCOUNT_CODE_BEGINNERS_ONE_TO_ONE",
    },
  };
  const code = process.env[envKeys[type][format]]?.trim();
  return code || null;
}

/** @deprecated Use verifiedDiscountCode */
export function studentDiscountCodeForFormat(format: StudentDiscountCourseFormat): string | null {
  return verifiedDiscountCode(format, "student");
}

export function checkoutKeyForFormat(format: StudentDiscountCourseFormat): string {
  return format === "group" ? "beginners-group" : "beginners-one-to-one";
}

export function verifiedDiscountRequestLabel(
  format: StudentDiscountCourseFormat,
  type: VerifiedDiscountType
): string {
  return `${VERIFIED_DISCOUNT_TYPE_LABELS[type]} · ${STUDENT_DISCOUNT_FORMAT_LABELS[format]}`;
}
