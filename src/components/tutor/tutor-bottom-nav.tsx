"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

function iconClass(active: boolean) {
  return `h-6 w-6 ${active ? "text-violet-700" : "text-zinc-400"}`;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
    </svg>
  );
}

function ClassesIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <rect x="3.75" y="3.75" width="7" height="7" rx="1.5" />
      <rect x="13.25" y="3.75" width="7" height="7" rx="1.5" />
      <rect x="3.75" y="13.25" width="7" height="7" rx="1.5" />
      <rect x="13.25" y="13.25" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function LogIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9" />
      <circle cx="12" cy="12" r="9" />
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

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M4.5 8.25h15M4.5 19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V8.25H4.5v11.25Z" />
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
    href: "/dashboard/tutor/classes",
    label: "Classes",
    match: (pathname) =>
      pathname.startsWith("/dashboard/tutor/classes") || pathname.startsWith("/dashboard/tutor/cohort"),
  },
  {
    href: "/dashboard/tutor/log",
    label: "Log",
    match: (pathname) => pathname === "/dashboard/tutor/log" || pathname.startsWith("/dashboard/tutor/log/"),
  },
  {
    href: "/dashboard/tutor/homework",
    label: "Homework",
    match: (pathname) => pathname.startsWith("/dashboard/tutor/homework"),
  },
  {
    href: "/dashboard/tutor/calendar",
    label: "Calendar",
    match: (pathname) => pathname.startsWith("/dashboard/tutor/calendar"),
  },
];

const icons = [HomeIcon, ClassesIcon, LogIcon, HomeworkIcon, CalendarIcon];

export function TutorBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom,0px)]">
      <ul className="mx-auto flex max-w-lg">
        {navItems.map((item, index) => {
          const active = item.match(pathname);
          const Icon = icons[index]!;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-medium ${
                  active ? "text-violet-700" : "text-zinc-400"
                }`}
              >
                <Icon active={active} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
