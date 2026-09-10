import { BackLink } from "@/components/navigation/back-link";
import { SwitchCohortRequestSection } from "@/components/learn/switch-cohort-request-section";
import { SWITCH_COHORT_FEE_FOOTER } from "@/lib/calendar/cohort-week-progress";
import type { SwitchCohortPageData } from "@/lib/calendar/load-switch-cohort-page";
import { ui } from "@/lib/ui/styles";

export function SwitchCohortPageView({ data }: { data: SwitchCohortPageData }) {
  const showFooterBeforeSubmit =
    data.sourceSession?.cohortSwitchRequest?.status !== "pending" &&
    data.sourceSession?.cohortSwitchRequest?.status !== "approved";

  return (
    <div className={ui.page}>
      <BackLink href={data.backHref}>← Back</BackLink>
      <h1 className="mt-4 font-heading text-2xl font-bold tracking-tight text-zinc-900">
        Switch cohort
      </h1>

      <div className="mt-4 space-y-2 text-sm leading-relaxed text-zinc-600">
        <p>Sorry to hear you can&apos;t make your cohort anymore.</p>
        <p>
          If you do need to move cohorts, there&apos;s a switching fee of £50. Here are the cohorts
          you could move to.
        </p>
      </div>

      <section className={`${ui.cardBordered} mt-6 space-y-1`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Your current cohort
        </p>
        <p className="font-semibold text-zinc-900">{data.current.name}</p>
        <p className="text-sm text-zinc-600">{data.current.tutorName}</p>
        {data.current.progressLine ? (
          <p className="text-sm text-zinc-500">{data.current.progressLine}</p>
        ) : null}
      </section>

      <div className="mt-6">
        <SwitchCohortRequestSection
          sourceSession={data.sourceSession}
          alternates={data.alternates}
          canRequest={data.canRequest}
          lockedReason={data.lockedReason}
          isShortNotice={data.isShortNotice}
        />
      </div>

      {showFooterBeforeSubmit && data.alternates.length === 0 ? (
        <p className="mt-6 text-center text-xs text-zinc-500">{SWITCH_COHORT_FEE_FOOTER}</p>
      ) : null}
    </div>
  );
}
