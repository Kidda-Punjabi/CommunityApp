"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

function AttendanceIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function HomeworkIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
    </svg>
  );
}

function LessonsIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M4.5 8.25h15M4.5 19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V8.25H4.5v11.25Z" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    href: "/dashboard/tutor",
    label: "Home",
    match: (pathname) => pathname === "/dashboard/tutor",
  },
  {
    href: "/dashboard/tutor/attendance",
    label: "Attendance",
    match: (pathname) => pathname.startsWith("/dashboard/tutor/attendance"),
  },
  {
    href: "/dashboard/tutor/homework",
    label: "Homework",
    match: (pathname) => pathname.startsWith("/dashboard/tutor/homework"),
  },
  {
    href: "/dashboard/tutor/lessons",
    label: "Lessons",
    match: (pathname) =>
      pathname.startsWith("/dashboard/tutor/lessons") ||
      pathname.startsWith("/dashboard/tutor/student") ||
      pathname.startsWith("/dashboard/tutor/cohort"),
  },
  {
    href: "/dashboard/tutor/calendar",
    label: "Calendar",
    match: (pathname) =>
      pathname.startsWith("/dashboard/tutor/calendar") ||
      pathname.startsWith("/dashboard/tutor/requests"),
  },
  {
    href: "/dashboard/tutor/profile",
    label: "Profile",
    match: (pathname) => pathname.startsWith("/dashboard/tutor/profile"),
  },
];

function NavIcon({ label, active }: { label: string; active: boolean }) {
  switch (label) {
    case "Home":
      return <HomeIcon active={active} />;
    case "Attendance":
      return <AttendanceIcon active={active} />;
    case "Homework":
      return <HomeworkIcon active={active} />;
    case "Lessons":
      return <LessonsIcon active={active} />;
    case "Calendar":
      return <CalendarIcon active={active} />;
    case "Profile":
      return <ProfileIcon active={active} />;
    default:
      return null;
  }
}

export function TutorBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-violet-200/70 bg-violet-50/95 shadow-[0_-4px_24px_-8px_rgba(124,58,237,0.12)] backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        {navItems.map((item) => {
          const active = item.match(pathname);

          return (
            <Link
              key={item.href}
              href={item.href}
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
      </div>
    </nav>
  );
}
