import { CohortOpsIssueList } from "@/components/admin/cohort-ops/cohort-ops-issue-list";

export const dynamic = "force-dynamic";

export default function AdminCohortsSetupPage() {
  return (
    <CohortOpsIssueList
      kind="setup"
      title="Cohorts needing setup"
      description="Live cohorts missing a tutor, a connected Google Calendar, or a recurring Kidda Class series."
    />
  );
}
