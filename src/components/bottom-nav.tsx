"use client";

import { NavLink } from "@/components/ui/nav-link";
import { usePathname } from "next/navigation";
import { useTabNav } from "@/components/navigation/tab-nav-provider";
import { useKidSession } from "@/components/kids/kid-session-provider";
import { tabIdFromHref } from "@/lib/navigation/tab-nav";

type NavItem = {
  href: string;
  label: string;
};

function iconClass(active: boolean) {
  return `h-6 w-6 transition-colors ${
    active ? "text-violet-600" : "text-zinc-400 group-hover:text-zinc-600"
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

function PracticeIcon({ active }: { active: boolean }) {
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
        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
      />
    </svg>
  );
}

function CommunityIcon({ active }: { active: boolean }) {
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
        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
      />
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
  { href: "/dashboard/home", label: "Home" },
  { href: "/dashboard/learn", label: "Learn" },
  { href: "/dashboard/community", label: "Community" },
  { href: "/dashboard/games", label: "Games" },
  { href: "/dashboard/profile", label: "Profile" },
];

function NavIcon({ href, active }: { href: string; active: boolean }) {
  switch (href) {
    case "/dashboard/home":
      return <HomeIcon active={active} />;
    case "/dashboard/learn":
      return <LearnIcon active={active} />;
    case "/dashboard/games":
      return <PracticeIcon active={active} />;
    case "/dashboard/community":
      return <CommunityIcon active={active} />;
    case "/dashboard/profile":
      return <ProfileIcon active={active} />;
    default:
      return null;
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const { activeTab, setActiveTab } = useTabNav();
  const { activeKidProfile, forumBlocked } = useKidSession();

  if (pathname.startsWith("/dashboard/tutor")) {
    return null;
  }

  if (pathname.startsWith("/dashboard/kids")) {
    return null;
  }

  const visibleNavItems = forumBlocked
    ? navItems.filter((item) => item.href !== "/dashboard/community")
    : navItems;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200/60 bg-white/90 shadow-[0_-4px_24px_-8px_rgba(24,24,27,0.08)] backdrop-blur-md">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">
        {visibleNavItems.map((item) => {
          const tabId = tabIdFromHref(item.href);
          const active = activeTab === tabId;

          return (
            <NavLink
              key={item.href}
              href={item.href}
              onClick={() => setActiveTab(tabId)}
              className={`group flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1 transition-colors ${
                active ? "text-violet-600" : "text-zinc-500"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center">
                <NavIcon href={item.href} active={active} />
              </span>
              <span
                className={`text-[10px] font-semibold tracking-wide ${
                  active ? "text-violet-600" : "text-zinc-500"
                }`}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
