import {
  ActionListRow,
  HubCard,
  StatusBadge,
} from "@/components/ui/hub-primitives";

type HomeActionListProps = {
  membersStudiedTodayLabel?: string | null;
  showLiveTranslate?: boolean;
  showPhotoTranslate?: boolean;
};

export function HomeActionList({
  membersStudiedTodayLabel,
  showLiveTranslate = false,
  showPhotoTranslate = false,
}: HomeActionListProps) {
  return (
    <HubCard className="divide-y divide-zinc-100 py-0">
      {showLiveTranslate ? (
        <ActionListRow
          href="/dashboard/live-translate"
          icon="🗣️"
          eyebrow="Utility"
          title="Live Translate"
          subtitle="Real-time Punjabi ↔ English for face-to-face conversations"
          badge={<StatusBadge variant="live">Live</StatusBadge>}
        />
      ) : null}
      {showPhotoTranslate ? (
        <ActionListRow
          href="/dashboard/photo-translate"
          icon="📷"
          eyebrow="Utility"
          title="Photo Translate"
          subtitle="Snap a photo of Punjabi text on signs, menus, or labels"
        />
      ) : null}
      <ActionListRow
        href="/dashboard/profile/progress"
        icon="📈"
        eyebrow="Progress"
        title="Your learning journey"
        subtitle="Level, XP, streaks, and level-up tests"
      />
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
