"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: (active: boolean) => JSX.Element;
};

function iconClass(active: boolean) {
  return `h-6 w-6 transition-colors ${
    active ? "text-emerald-600" : "text-zinc-400 group-hover:text-zinc-600"
  }`;
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.75}
      className={iconClass(active)}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
      />
    </svg>
  );
}

function LearnIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.75}
      className={iconClass(active)}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

function GamesIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.75}
      className={iconClass(active)}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.5 8.25h11A3.75 3.75 0 0 1 21.25 12v1.25A3.75 3.75 0 0 1 17.5 17H6.5A3.75 3.75 0 0 1 2.75 13.25V12A3.75 3.75 0 0 1 6.5 8.25Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10.75v3.5M6.25 12.5h3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.25 11.25h.01M17.5 13.5h.01" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.75}
      className={iconClass(active)}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

const navItems: NavItem[] = [
  { href: "/dashboard/english", label: "Home", icon: HomeIcon },
  { href: "/dashboard/english/learn", label: "Learn", icon: LearnIcon },
  { href: "/dashboard/english/games", label: "Games", icon: GamesIcon },
  { href: "/dashboard/english/profile", label: "Profile", icon: ProfileIcon },
];

export function EnglishBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 border-t border-emerald-200/60 bg-white/90 shadow-[0_-4px_24px_-8px_rgba(5,150,105,0.08)] backdrop-blur-md">
      <div className="pointer-events-auto mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 transition-colors ${
                active ? "text-emerald-600" : "text-zinc-500"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center">
                {item.icon(active)}
              </span>
              <span
                className={`text-[10px] font-semibold tracking-wide ${
                  active ? "text-emerald-600" : "text-zinc-500"
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
