"use client";

import { fetchPeopleHubStats } from "@/app/admin/content/people-hub-actions";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import {
  AdminHubLinkCard,
  AdminHubPage,
  AdminHubStack,
} from "@/components/admin/admin-hub-list";
import { CreditCard, GraduationCap, Hand, Tag, UserRound, Users } from "lucide-react";
import { useEffect, useState } from "react";

type HubRow = {
  href: string;
  icon: typeof Users;
  title: string;
  descriptionKey?: "cohorts" | "members" | "payments" | "discounts" | "staff";
  fallback: string;
};

const rows: HubRow[] = [
  {
    href: "/admin/content/people/cohorts",
    icon: Users,
    title: "Cohorts",
    descriptionKey: "cohorts",
    fallback: "Active groups and allocations",
  },
  {
    href: "/admin/content/people/members",
    icon: UserRound,
    title: "Members",
    descriptionKey: "members",
    fallback: "Enrolled members",
  },
  {
    href: "/admin/content/people/payments",
    icon: CreditCard,
    title: "Payments",
    descriptionKey: "payments",
    fallback: "Stripe checkout sessions",
  },
  {
    href: "/admin/content/people/discounts",
    icon: Tag,
    title: "Discounts",
    descriptionKey: "discounts",
    fallback: "Discount applications",
  },
  {
    href: "/admin/content/people/staff",
    icon: GraduationCap,
    title: "Staff & tutors",
    descriptionKey: "staff",
    fallback: "Staff and tutor assignments",
  },
  {
    href: "/admin/content/people/interest",
    icon: Hand,
    title: "Course interest",
    fallback: "Coming-soon Intermediate and Advanced waitlist",
  },
];

export function AdminPeopleHub() {
  const { data } = useAdminData();
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPeopleHubStats(data.enrollments.length, data.staffMembers.length).then((result) => {
      if (cancelled) return;
      setDescriptions({
        cohorts: result.stats.cohorts,
        members: result.stats.members,
        payments: result.stats.payments,
        discounts: result.stats.discounts,
        staff: result.stats.staff,
      });
      setStatsError(result.error ?? null);
      setLoadingStats(false);
    });
    return () => {
      cancelled = true;
    };
  }, [data.enrollments.length, data.staffMembers.length]);

  return (
    <AdminHubPage
      title="People"
      description="View cohorts and allocations, manage members, review discount applications, and assign tutors or staff."
    >
      <AdminFetchErrors errors={data.errors} />

      {statsError ? (
        <p className="mb-6 rounded-[12px] border-[0.5px] border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {statsError}
        </p>
      ) : null}

      <AdminHubStack>
        {rows.map((row) => {
          const Icon = row.icon;
          const summary = row.descriptionKey
            ? descriptions[row.descriptionKey] ?? (loadingStats ? "Loading…" : row.fallback)
            : row.fallback;
          return (
            <AdminHubLinkCard
              key={row.href}
              href={row.href}
              icon={<Icon className="h-[18px] w-[18px]" />}
              title={row.title}
              summary={summary}
            />
          );
        })}
      </AdminHubStack>
    </AdminHubPage>
  );
}
