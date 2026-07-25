import {
  ActionListRow,
  HubCard,
  StatusBadge,
} from "@/components/ui/hub-primitives";
import { RESOURCES_CATALOG } from "@/lib/resources/catalog";
import { ui } from "@/lib/ui/styles";
import Link from "next/link";

type ResourceListSectionProps = {
  membersStudiedTodayLabel?: string | null;
  showLiveTranslate?: boolean;
  showPhotoTranslate?: boolean;
};

function ChevronRight() {
  return (
    <span className="text-lg leading-none text-zinc-400" aria-hidden="true">
      ›
    </span>
  );
}

/** Learn hub shortcuts — links into existing features, not duplicated logic. */
export function ResourceListSection({
  membersStudiedTodayLabel,
  showLiveTranslate = false,
  showPhotoTranslate = false,
}: ResourceListSectionProps) {
  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4">
          <h2 className={ui.sectionTitle}>Practice & progress</h2>
          <p className="text-sm text-zinc-500">
            Jump into tools and social features — scoring stays in Games and Community.
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
        </HubCard>
      </section>

      <section>
        <div className="mb-4">
          <h2 className={ui.sectionTitle}>Reference</h2>
          <p className="text-sm text-zinc-500">
            Dictionary and grammar tools — no scores, just learning.
          </p>
        </div>
        <div className={`${ui.card} divide-y divide-zinc-100 px-4 py-1`}>
          {RESOURCES_CATALOG.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 py-3 transition-colors hover:text-violet-600"
            >
              <span className="min-w-0 flex-1 font-heading text-sm font-semibold text-zinc-900">
                {item.title}
              </span>
              <span className="text-xs text-zinc-500">{item.description}</span>
              <ChevronRight />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
