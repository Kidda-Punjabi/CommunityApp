"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminWidthContainer } from "@/components/admin/admin-width-container";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

function iconClass(active: boolean) {
  return `h-6 w-6 transition-colors ${
    active ? "text-violet-700" : "text-violet-400 group-hover:text-violet-600"
  }`;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  );
}

function CohortsIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function PaymentsIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    </svg>
  );
}

function ContentIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    href: "/admin",
    label: "Home",
    match: (pathname) => pathname === "/admin" || pathname === "/admin/content",
  },
  {
    href: "/admin/cohorts-hub",
    label: "Cohorts",
    match: (pathname) =>
      pathname.startsWith("/admin/cohorts-hub") ||
      pathname.startsWith("/admin/packages") ||
      pathname.startsWith("/admin/lesson-log") ||
      pathname.startsWith("/admin/reschedule-requests") ||
      pathname.startsWith("/admin/cover-requests") ||
      pathname.startsWith("/admin/cohort-switch-requests") ||
      pathname.startsWith("/admin/cohort-change-requests") ||
      pathname.startsWith("/admin/test-cohort-switch") ||
      pathname.startsWith("/admin/test-session-reschedule"),
  },
  {
    href: "/admin/content/people",
    label: "People",
    match: (pathname) =>
      (pathname.startsWith("/admin/content/people") ||
        pathname.startsWith("/admin/content/tutors")) &&
      !pathname.startsWith("/admin/content/people/payments"),
  },
  {
    href: "/admin/payments-hub",
    label: "Payments",
    match: (pathname) =>
      pathname.startsWith("/admin/payments-hub") ||
      pathname.startsWith("/admin/content/people/payments") ||
      pathname.startsWith("/admin/sales-calls") ||
      pathname.startsWith("/admin/onboarding") ||
      pathname.startsWith("/admin/app-onboarding"),
  },
  {
    href: "/admin/content-hub",
    label: "Content",
    match: (pathname) =>
      pathname.startsWith("/admin/content-hub") ||
      pathname.startsWith("/admin/content/curriculum") ||
      pathname.startsWith("/admin/content/games") ||
      pathname.startsWith("/admin/content/audio-review") ||
      pathname.startsWith("/admin/content/site") ||
      pathname.startsWith("/admin/content/kids-stories") ||
      pathname.startsWith("/admin/content/help") ||
      pathname.startsWith("/admin/public-forms") ||
      pathname.startsWith("/admin/monthly-rewards"),
  },
];

function NavIcon({ label, active }: { label: string; active: boolean }) {
  switch (label) {
    case "Home":
      return <HomeIcon active={active} />;
    case "Cohorts":
      return <CohortsIcon active={active} />;
    case "People":
      return <PeopleIcon active={active} />;
    case "Payments":
      return <PaymentsIcon active={active} />;
    case "Content":
      return <ContentIcon active={active} />;
    default:
      return null;
  }
}

export function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-200/70 bg-violet-50/95 shadow-[0_-4px_24px_-8px_rgba(124,58,237,0.12)] backdrop-blur-md">
      <AdminWidthContainer className="flex items-stretch justify-around px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-5">
        {navItems.map((item) => {
          const active = item.match(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`group flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 py-1 transition-colors ${
                active ? "text-violet-700" : "text-violet-500"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center">
                <NavIcon label={item.label} active={active} />
              </span>
              <span
                className={`text-[10px] font-semibold tracking-wide ${
                  active ? "text-violet-700" : "text-violet-500"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </AdminWidthContainer>
    </nav>
  );
}
