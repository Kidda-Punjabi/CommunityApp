import Link from "next/link";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { ProfileNameFields } from "@/lib/profile/display-name";

type HomeGreetingHeaderProps = {
  greetingHeading: string;
  profile: ProfileNameFields & { avatar_url?: string | null };
  unreadNotificationCount: number;
};

export function HomeGreetingHeader({
  greetingHeading,
  profile,
  unreadNotificationCount,
}: HomeGreetingHeaderProps) {
  return (
    <header className="mb-8 flex items-center gap-4">
      <Link href="/dashboard/profile/edit" className="shrink-0" aria-label="Edit profile">
        <UserAvatar profile={profile} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-violet-600">Welcome back</p>
        <h1 className="truncate font-heading text-2xl font-bold tracking-tight text-zinc-900">
          {greetingHeading}
        </h1>
      </div>
      <NotificationBell unreadCount={unreadNotificationCount} />
    </header>
  );
}
