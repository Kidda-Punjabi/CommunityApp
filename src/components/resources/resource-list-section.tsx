import {
  ActionListRow,
  HubCard,
  StatusBadge,
} from "@/components/ui/hub-primitives";
import { RESOURCES_CATALOG } from "@/lib/resources/catalog";
import { ui } from "@/lib/ui/styles";

type ResourceListSectionProps = {
  membersStudiedTodayLabel?: string | null;
  showLiveTranslate?: boolean;
  showPhotoTranslate?: boolean;
};

const REFERENCE_ICONS: Record<string, string> = {
  "/dashboard/games/dictionary": "📖",
  "/dashboard/games/verb-conjugator": "🔤",
  "/dashboard/resources/dialects": "🗺️",
};

/** Learn hub shortcuts — links into existing features, not duplicated logic. */
export function ResourceListSection({
  membersStudiedTodayLabel,
  showLiveTranslate = false,
  showPhotoTranslate = false,
}: ResourceListSectionProps) {
  return (
    <section>
      <div className="mb-4">
        <h2 className={ui.sectionTitle}>Practice & progress</h2>
        <p className="text-sm text-zinc-500">
          Jump into tools, reference, and social features — scoring stays in Games and
          Community.
        </p>
      </div>
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
          href="/dashboard/challenges/new"
          icon="⚔️"
          eyebrow="Games"
          title="Challenge a friend"
          subtitle="Send a head-to-head game challenge"
        />
        <ActionListRow
          href="/dashboard/battle"
          icon="⚡"
          eyebrow="Games"
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
        {RESOURCES_CATALOG.map((item) => (
          <ActionListRow
            key={item.href}
            href={item.href}
            icon={REFERENCE_ICONS[item.href] ?? "📚"}
            eyebrow="Reference"
            title={item.title}
            subtitle={item.description}
          />
        ))}
      </HubCard>
    </section>
  );
}
