import Link from "next/link";
import { HubCard, StatusBadge } from "@/components/ui/hub-primitives";
import { formatSessionWhenUk } from "@/lib/calendar/uk-display-time";
import { COMMUNITY_CLASS_FEEDBACK_LOOKBACK_DAYS } from "@/lib/feedback/constants";
import type { CommunityClassFeedbackSession } from "@/lib/feedback/community-class";
import { pressableClass } from "@/lib/ui/pressable";

type CommunityClassFeedbackSectionProps = {
  sessions: CommunityClassFeedbackSession[];
};

export function CommunityClassFeedbackSection({
  sessions,
}: CommunityClassFeedbackSectionProps) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-lg font-medium text-zinc-900">Class feedback</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Leave feedback for a Kidda Community Class you attended in the last{" "}
          {COMMUNITY_CLASS_FEEDBACK_LOOKBACK_DAYS} days.
        </p>
      </div>

      <HubCard className="py-4">
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No recent Community Classes to give feedback on yet. Classes appear here
            after they start.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {sessions.map((session) => (
              <li key={session.id}>
                {session.submitted ? (
                  <div className="flex items-start justify-between gap-3 py-3">
                    <SessionCopy session={session} />
                    <StatusBadge variant="success">Done</StatusBadge>
                  </div>
                ) : (
                  <Link
                    href={`/dashboard/community/feedback/${session.id}`}
                    className={`${pressableClass} -mx-2 flex items-start justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-violet-50/40`}
                  >
                    <SessionCopy session={session} />
                    <span className="shrink-0 text-sm font-medium text-violet-600">
                      Leave feedback
                    </span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </HubCard>
    </section>
  );
}

function SessionCopy({ session }: { session: CommunityClassFeedbackSession }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-medium text-zinc-900">
        {formatSessionWhenUk(session.startsAt)}
      </p>
      <p className="mt-0.5 text-sm text-zinc-500">
        {session.tutorName ? `with ${session.tutorName}` : "Kidda Community Class"}
      </p>
    </div>
  );
}
