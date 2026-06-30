import { STUDENT_DISCOUNT_EVIDENCE_BUCKET } from "@/lib/student-discounts/constants";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function validateStudentDiscountEvidence(file: File): string | null {
  if (!ALLOWED_TYPES.has(file.type)) {
    return "Please upload a JPG, PNG, WebP image, or PDF.";
  }
  if (file.size > MAX_BYTES) {
    return "File must be 10 MB or smaller.";
  }
  return null;
}

export function studentDiscountEvidencePath(userId: string, requestId: string, file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `${userId}/${requestId}.${ext}`;
}

export { STUDENT_DISCOUNT_EVIDENCE_BUCKET };
