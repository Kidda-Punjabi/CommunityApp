import type { PackageInstanceStatus, PackageMembershipStatus } from "@/lib/admin/package-status";
import type { OnboardingChecklistRow } from "@/lib/admin/packages/types";

export type OnboardingQueue = "onboarding" | "offboarding";

export const ONBOARDING_CHECKLIST_PROGRESS_KEYS = [
  "timeAssigned",
  "welcomeEmail",
  "calendarInvite",
  "tutorNotified",
  "packageCreated",
  "whatsappChatMade",
  "scheduleWhatsappChat",
] as const satisfies ReadonlyArray<keyof OnboardingChecklistRow>;

export type AdminOnboardingRow = {
  studentPackageId: string;
  userId: string;
  studentLabel: string;
  email: string | null;
  membershipStatus: PackageMembershipStatus;
  courseId: string;
  courseName: string;
  deliveryMode: "group" | "one_to_one";
  packageRunId: string | null;
  packageRunKind: "cohort" | "package_instance" | null;
  packageRunName: string | null;
  packageRunHref: string | null;
  packageRunStatus: PackageInstanceStatus | null;
  tutorName: string | null;
  checklistType: "group" | "one_to_one";
  checklist: OnboardingChecklistRow | null;
  progressDone: number;
  progressTotal: number;
  isOverdue: boolean;
  queue: OnboardingQueue;
  paymentDate: string | null;
  purchasedAt: string;
};

export type AdminOnboardingCompletedRow = {
  studentPackageId: string;
  studentLabel: string;
  email: string | null;
  courseName: string;
  packageRunName: string | null;
  packageRunHref: string | null;
  packageRunStatus: PackageInstanceStatus | null;
  tutorName: string | null;
  membershipStatus: PackageMembershipStatus;
  paymentDate: string | null;
  completedAt: string | null;
  checklistType: "group" | "one_to_one";
  checklist: OnboardingChecklistRow | null;
};

export type AdminOnboardingSummary = {
  onboardingCount: number;
  offboardingCount: number;
  overdueCount: number;
  completedCount: number;
};
