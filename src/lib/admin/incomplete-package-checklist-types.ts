import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import type { OnboardingChecklistRow } from "@/lib/admin/packages/types";

export type IncompletePackageChecklistRow = {
  checklistId: string;
  studentPackageId: string;
  packageInstanceId: string | null;
  userId: string | null;
  displayName: string;
  email: string | null;
  courseName: string;
  packageName: string;
  membershipStatus: PackageMembershipStatus | null;
  checklistType: "group" | "one_to_one";
  createdAt: string;
  stale: boolean;
  checklist: OnboardingChecklistRow;
  outstandingLabels: string[];
};
