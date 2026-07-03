import {
  ActionListRow,
  HubCard,
  StatusBadge,
} from "@/components/ui/hub-primitives";

type HomeActionListProps = {
  membersStudiedTodayLabel?: string | null;
};

export function HomeActionList({ membersStudiedTodayLabel }: HomeActionListProps) {
  return (
    <HubCard className="divide-y divide-zinc-100 py-0">
      <ActionListRow
        href="/dashboard/schedule"
        icon="📅"
        eyebrow="Tutoring"
        title="Upcoming lessons"
        subtitle="Join live sessions and request to reschedule if needed"
      />
      <ActionListRow
        href="/dashboard/challenges/new"
        icon="⚔️"
        eyebrow="Friends"
        title="Challenge a friend"
        subtitle="Send a head-to-head game challenge"
      />
      <ActionListRow
        href="/dashboard/battle"
        icon="⚡"
        eyebrow="Live PvP"
        title="Battle a friend"
        subtitle="Real-time duel — fastest correct answer wins"
        badge={<StatusBadge variant="live">Live</StatusBadge>}
      />
      <ActionListRow
        href="/dashboard/community#leaderboard"
        icon="🏆"
        eyebrow="Community"
        title="Weekly leaderboard"
        subtitle={
          membersStudiedTodayLabel
            ? `${membersStudiedTodayLabel} · See who's practised most this week`
            : "See who's practised the most this week"
        }
      />
    </HubCard>
  );
}
