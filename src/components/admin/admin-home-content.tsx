"use client";

import { fetchAdminHomeAttention, type AdminAttentionCategory } from "@/app/admin/content/home-actions";
import { fetchAdminTutorOverview } from "@/app/admin/content/tutor-overview-actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import {
  AdminHubLinkCard,
  AdminHubPage,
  AdminHubStack,
} from "@/components/admin/admin-hub-list";
import { AdminStatsBar } from "@/components/admin/admin-stats-bar";
import { formatTutorOverviewSummary } from "@/components/admin/admin-tutor-overview-panel";
import {
  ArrowLeftRight,
  Gift,
  GraduationCap,
  HelpCircle,
  Sparkles,
  Phone,
  ScrollText,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";

const ATTENTION_ICONS: Record<AdminAttentionCategory["id"], typeof Users> = {
  cohort_switch: ArrowLeftRight,
  enrollment_gaps: UserPlus,
  cohorts_setup: Users,
  payment_setup: ScrollText,
  monthly_rewards: Gift,
};

export function AdminHomeContent() {
  const { data } = useAdminData();
  const [categories, setCategories] = useState<AdminAttentionCategory[]>([]);
  const [attentionError, setAttentionError] = useState<string | null>(null);
  const [loadingAttention, setLoadingAttention] = useState(true);
  const [tutorCount, setTutorCount] = useState(0);
  const [nearCapacity, setNearCapacity] = useState(0);
  const [loadingTutorSummary, setLoadingTutorSummary] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminHomeAttention().then((result) => {
      if (cancelled) return;
      setCategories(result.categories);
      setAttentionError(result.error ?? null);
      setLoadingAttention(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchAdminTutorOverview().then((result) => {
      if (cancelled) return;
      const near = result.tutors.filter((row) => (row.capacityPercent ?? 0) >= 85).length;
      setTutorCount(result.tutors.length);
      setNearCapacity(near);
      setLoadingTutorSummary(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tutorSummary = formatTutorOverviewSummary(tutorCount, nearCapacity);

  return (
    <AdminHubPage
      title="Admin home"
      description="At-a-glance stats, items that need action, and quick links."
    >
      <AdminFetchErrors errors={data.errors} />

      <div className="mb-8">
        <AdminStatsBar
          courses={data.courses.length}
          membersEnrolled={data.enrollments.length}
          cohorts={data.cohorts.length}
          staff={data.staffMembers.length}
        />
      </div>

      {attentionError ? (
        <p className="mb-6 rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {attentionError}
        </p>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Needs attention
        </h2>
        {loadingAttention ? (
          <p className="text-[13px] text-zinc-500">Loading live counts…</p>
        ) : (
          <AdminHubStack>
            {categories.map((category) => {
              const Icon = ATTENTION_ICONS[category.id];
              return (
                <AdminHubLinkCard
                  key={category.id}
                  href={category.href}
                  icon={<Icon className="h-[18px] w-[18px]" />}
                  title={category.title}
                  summary={category.description}
                  count={category.count}
                  tone={category.tone}
                />
              );
            })}
          </AdminHubStack>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
          Sections
        </h2>
        <AdminHubStack>
          <AdminHubLinkCard
            href="/admin/cohort-switch-requests"
            icon={<ArrowLeftRight className="h-[18px] w-[18px]" />}
            title="Cohort change requests"
            summary="Approve or decline student requests to join an alternate group session"
          />
          <AdminHubLinkCard
            href="/admin/public-forms"
            icon={<ScrollText className="h-[18px] w-[18px]" />}
            title="Public forms"
            summary="Preview and test every backlog quiz and feedback link, including Week 1 starting point and Week 12"
          />
          <AdminHubLinkCard
            href="/admin/sales-calls"
            icon={<Phone className="h-[18px] w-[18px]" />}
            title="Sales calls"
            summary="Create and edit sales call log entries synced with Notion"
          />
          <AdminHubLinkCard
            href="/admin/monthly-rewards"
            icon={<Gift className="h-[18px] w-[18px]" />}
            title="Monthly Rewards"
            summary="Calculate monthly top 3 and send Prezzee gift cards"
          />
          <AdminHubLinkCard
            href="/admin/content/tutors"
            icon={<GraduationCap className="h-[18px] w-[18px]" />}
            title="Tutor overview"
            summary={loadingTutorSummary ? "Loading tutor summary…" : tutorSummary}
          />
          <AdminHubLinkCard
            href="/admin/content/kids-stories"
            icon={<Sparkles className="h-[18px] w-[18px]" />}
            title="Kids bedtime stories"
            summary="Author Premium kids stories (empty until content is approved)"
          />
          <AdminHubLinkCard
            href="/admin/content/help"
            icon={<HelpCircle className="h-[18px] w-[18px]" />}
            title="Help articles"
            summary="FAQs and SOPs for cohorts, members, curriculum, and payments"
          />
        </AdminHubStack>
      </section>
    </AdminHubPage>
  );
}
