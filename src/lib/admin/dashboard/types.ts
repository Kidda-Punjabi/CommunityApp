export type DashboardTone = "ok" | "warning" | "urgent";

export type DashboardCardId =
  | "cohorts_setup"
  | "cohort_switch"
  | "reschedule"
  | "cohort_change"
  | "issue_reports"
  | "enrollment_gaps"
  | "unresolved_enrollments"
  | "payment_setup"
  | "app_onboarding"
  | "package_onboarding"
  | "monthly_rewards"
  | "missing_recordings"
  | "session_integrity";

export type AdminDashboardCard = {
  id: DashboardCardId;
  label: string;
  hint: string;
  href: string;
  count: number;
  tone: DashboardTone;
  group: "enrollment" | "requests" | "cohorts" | "ops";
  /** One-line issue breakdown. Only set on the cohort setup and integrity cards. */
  detail?: string;
};

export type AdminDashboardSnapshot = {
  cards: AdminDashboardCard[];
  error?: string;
};
