export type AppOnboardingMilestoneKey =
  | "signedUp"
  | "emailConfirmed"
  | "profileFilled"
  | "placementDone"
  | "practiced";

export type AppOnboardingMilestones = Record<AppOnboardingMilestoneKey, boolean>;

export type AppOnboardingFilter = "all" | "in_progress" | "complete";

export type AdminAppOnboardingRow = {
  userId: string;
  email: string | null;
  displayName: string;
  signedUpAt: string;
  learnerLevel: number | null;
  milestones: AppOnboardingMilestones;
  progressDone: number;
  progressTotal: number;
  isComplete: boolean;
};

export type AdminAppOnboardingSummary = {
  totalCount: number;
  inProgressCount: number;
  completeCount: number;
};
