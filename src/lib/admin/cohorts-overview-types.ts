export type CohortMemberOverview = {
  userId: string;
  label: string;
  email: string | null;
  joinedAt: string;
  packageStatus: string | null;
  hasEnrollment: boolean;
  enrollmentDeliveryMode: string | null;
};

export type CohortOverview = {
  id: string;
  name: string;
  courseName: string;
  tutorLabel: string | null;
  active: boolean;
  createdAt: string;
  memberCount: number;
  members: CohortMemberOverview[];
};

export type UnallocatedGroupBuyer = {
  userId: string;
  label: string;
  email: string | null;
  packageStatus: string;
  purchasedAt: string;
};

export type CohortsOverviewData = {
  cohorts: CohortOverview[];
  unallocatedGroupBuyers: UnallocatedGroupBuyer[];
  stats: {
    activeCohorts: number;
    totalAllocated: number;
    unallocatedGroup: number;
    oneToOneBeginners: number;
  };
};

export function packageStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_setup: "Pending setup",
    active: "Active",
    paused: "Paused",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}
