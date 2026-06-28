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

function PeopleIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function CurriculumIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function GamesIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0M14.25 6.087c0 .355-.186.676-.401.959a1.32 1.32 0 0 0-.349 1.003c0 1.036 1.007 1.875 2.25 1.875s2.25-.84 2.25-1.875a1.32 1.32 0 0 0-.349-1.003 1.32 1.32 0 0 1-.401-.959v0M14.25 6.087H9m5.25 9.75h3.375c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9m9 9.75v1.5c0 .621-.504 1.125-1.125 1.125H9.75m0 0H6.375c-.621 0-1.125-.504-1.125-1.125V11.25a9 9 0 0 1 9-9m0 9.75v1.5" />
    </svg>
  );
}

function SiteIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.25 : 1.75} className={iconClass(active)}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

const navItems: NavItem[] = [
  {
    href: "/admin/content",
    label: "Home",
    match: (pathname) => pathname === "/admin/content",
  },
  {
    href: "/admin/content/people",
    label: "People",
    match: (pathname) => pathname.startsWith("/admin/content/people"),
  },
  {
    href: "/admin/content/curriculum",
    label: "Learn",
    match: (pathname) => pathname.startsWith("/admin/content/curriculum"),
  },
  {
    href: "/admin/content/games",
    label: "Games",
    match: (pathname) => pathname.startsWith("/admin/content/games"),
  },
  {
    href: "/admin/content/site",
    label: "Site",
    match: (pathname) => pathname.startsWith("/admin/content/site"),
  },
];

function NavIcon({ label, active }: { label: string; active: boolean }) {
  switch (label) {
    case "Home":
      return <HomeIcon active={active} />;
    case "People":
      return <PeopleIcon active={active} />;
    case "Learn":
      return <CurriculumIcon active={active} />;
    case "Games":
      return <GamesIcon active={active} />;
    case "Site":
      return <SiteIcon active={active} />;
    default:
      return null;
  }
}

export function AdminBottomNav() {
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
