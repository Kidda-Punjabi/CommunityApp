import type {
  StudentDiscountCourseFormat,
  StudentDiscountStatus,
  VerifiedDiscountType,
} from "@/lib/student-discounts/constants";

export type StudentDiscountRequestRow = {
  id: string;
  user_id: string;
  course_format: StudentDiscountCourseFormat;
  discount_type: VerifiedDiscountType;
  status: StudentDiscountStatus;
  storage_path: string;
  mime_type: string | null;
  discount_code: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentDiscountRequestView = {
  id: string;
  courseFormat: StudentDiscountCourseFormat;
  discountType: VerifiedDiscountType;
  status: StudentDiscountStatus;
  discountCode: string | null;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminStudentDiscountRequest = StudentDiscountRequestView & {
  userId: string;
  studentName: string;
  studentEmail: string | null;
  storagePath: string;
  mimeType: string | null;
};
