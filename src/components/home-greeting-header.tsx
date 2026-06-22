import Link from "next/link";
import { KiddaLogo } from "@/components/branding/kidda-logo";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { ProfileNameFields } from "@/lib/profile/display-name";

type HomeGreetingHeaderProps = {
  greetingHeading: string;
  profile: ProfileNameFields & { avatar_url?: string | null };
  learnerLevel?: number | null;
  unreadNotificationCount: number;
};

export async function HomeGreetingHeader({
  greetingHeading,
  profile,
  learnerLevel,
  unreadNotificationCount,
}: HomeGreetingHeaderProps) {
  return (
    <header className="mb-8 flex items-center gap-4">
      <Link href="/dashboard/profile/edit" className="shrink-0" aria-label="Edit profile">
        <UserAvatar profile={profile} level={learnerLevel} size="md" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <KiddaLogo variant="icon" size="xs" href="/dashboard/home" />
          <p className="text-sm font-medium text-violet-600">Welcome back to Kidda</p>
        </div>
        <h1 className="truncate font-heading text-2xl font-bold tracking-tight text-zinc-900">
          {greetingHeading}
        </h1>
      </div>
      <NotificationBell unreadCount={unreadNotificationCount} />
    </header>
  );
}
