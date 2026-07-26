import { ActionListRow, HubCard } from "@/components/ui/hub-primitives";
import { learnTrackPath } from "@/lib/learning/learn-catalog";

/** Entry point for paid Community course lessons (moved off the Learn hub grid). */
export function CommunityCourseEntry() {
  return (
    <HubCard className="divide-y divide-zinc-100 py-0">
      <ActionListRow
        href={learnTrackPath("community")}
        icon="📚"
        eyebrow="Course"
        title="Community course"
        subtitle="24 weeks of lessons, live sessions, and advanced content"
      />
    </HubCard>
  );
}
