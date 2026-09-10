export const COHORT_CHANGE_STATUSES = ["pending", "approved", "denied", "completed"] as const;
export type CohortChangeRequestStatus = (typeof COHORT_CHANGE_STATUSES)[number];

export const COHORT_CHANGE_FEE_STATUSES = ["unpaid", "paid", "waived"] as const;
export type CohortChangeFeeStatus = (typeof COHORT_CHANGE_FEE_STATUSES)[number];

export type AdminCourseOption = {
  id: string;
  name: string;
};

export type StudentCourseEnrollmentOption = {
  id: string;
  courseId: string;
  courseName: string;
};

export type AdminCohortChangeRequestRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  courseEnrollmentId: string | null;
  fromCourseId: string | null;
  fromCourseName: string;
  toCourseId: string | null;
  toCourseName: string;
  reason: string | null;
  feeAmount: number | null;
  feeStatus: CohortChangeFeeStatus;
  status: CohortChangeRequestStatus;
  adminNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
};
