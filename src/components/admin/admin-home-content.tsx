"use client";

import Link from "next/link";
import { useAdminData } from "@/app/admin/content/admin-data-provider";
import { AdminFetchErrors } from "@/components/admin/admin-fetch-errors";
import { ui } from "@/lib/ui/styles";

type HubLink = {
  href: string;
  title: string;
  description: string;
  stat: string;
};

export function AdminHomeContent() {
  const { data } = useAdminData();

  const links: HubLink[] = [
    {
      href: "/admin/content/help",
      title: "Help articles",
      description: "FAQs and SOPs for cohorts, members, curriculum, and payments",
      stat: "Admin guides",
    },
    {
      href: "/admin/content/people",
      title: "People",
      description: "Members, Stripe payments, tutors, and staff",
      stat: `${data.enrollments.length} enrollments`,
    },
    {
      href: "/admin/content/calendar",
      title: "Tutor calendars",
      description: "View synced lessons and remind tutors to connect Google Calendar",
      stat: `${data.staffMembers.length} staff`,
    },
    {
      href: "/admin/packages",
      title: "Packages",
      description: "Group cohorts and 1-1 runs — roster, schedule, and status",
      stat: `${data.cohorts.length} cohorts`,
    },
    {
      href: "/admin/content/curriculum",
      title: "Content",
      description: "Learn curriculum and practice games",
      stat: `${data.lessons.length} lessons`,
    },
    {
      href: "/admin/content/site",
      title: "Site & comms",
      description: "Events, announcements, branding, and debug tools",
      stat: `${data.events.length} events`,
    },
  ];

  return (
    <div className={ui.page}>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Admin home</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick a section below — same layout as the learner and tutor apps.
        </p>
      </div>

      <AdminFetchErrors errors={data.errors} />

      <div className="mb-8 grid grid-cols-2 gap-3">
        <StatCard label="Courses" value={data.courses.length} />
        <StatCard label="Members enrolled" value={data.enrollments.length} />
        <StatCard label="Cohorts" value={data.cohorts.length} />
        <StatCard label="Staff" value={data.staffMembers.length} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Sections
      </h2>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={`${ui.cardInteractive} flex items-center gap-4`}>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-zinc-900">{link.title}</p>
                <p className="mt-0.5 text-sm text-zinc-500">{link.description}</p>
                <p className="mt-1 text-xs font-medium text-violet-600">{link.stat}</p>
              </div>
              <span className="text-violet-600" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={ui.statCard}>
      <p className="text-2xl font-bold text-zinc-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-zinc-500">{label}</p>
    </div>
  );
}
