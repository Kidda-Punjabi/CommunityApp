import Link from "next/link";
import { HomeGreetingHeading } from "@/components/home/home-greeting-heading";
import { HomeHeaderPills } from "@/components/home/home-header-pills";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { ProfileNameFields } from "@/lib/profile/display-name";

type HomeGreetingHeaderProps = {
  displayName: string | null;
  profile: ProfileNameFields & { avatar_url?: string | null };
  learnerLevel?: number | null;
  unreadNotificationCount: number;
  weeklyPoints: number;
};

export function HomeGreetingHeader({
  displayName,
  profile,
  learnerLevel,
  unreadNotificationCount,
  weeklyPoints,
}: HomeGreetingHeaderProps) {
  return (
    <header className="mb-4">
      <div className="flex items-start gap-4">
        <Link href="/dashboard/profile" className="shrink-0" aria-label="Profile">
          <UserAvatar profile={profile} level={learnerLevel} size="md" />
        </Link>
        <div className="min-w-0 flex-1">
          <HomeGreetingHeading displayName={displayName} />
          <HomeHeaderPills weeklyPoints={weeklyPoints} />
        </div>
        <NotificationBell unreadCount={unreadNotificationCount} />
      </div>
    </header>
  );
}
