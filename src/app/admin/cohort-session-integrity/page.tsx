import { CohortOpsIssueList } from "@/components/admin/cohort-ops/cohort-ops-issue-list";

export const dynamic = "force-dynamic";

export default function AdminCohortSessionIntegrityPage() {
  return (
    <CohortOpsIssueList
      kind="integrity"
      title="Cohort session integrity"
      description="Kidda Class sessions still scheduled on a bank holiday, week-number problems, or sessions stored on the wrong cohort."
    />
  );
}
