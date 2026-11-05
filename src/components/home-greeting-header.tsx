import Link from "next/link";
import { HomeGreetingHeading } from "@/components/home/home-greeting-heading";
import { HomeHeaderPills } from "@/components/home/home-header-pills";
import { KidLucideIcon } from "@/components/kids/kid-lucide-icon";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { UserAvatar } from "@/components/profile/user-avatar";
import type { KidAvatarIcon } from "@/lib/kids/constants";
import type { ProfileNameFields } from "@/lib/profile/display-name";
import { levelFillVar } from "@/lib/community/levels";
import { cn, ui } from "@/lib/ui/styles";

type HomeGreetingHeaderProps = {
  displayName: string | null;
  profile: ProfileNameFields & { avatar_url?: string | null };
  kidAvatarIcon?: KidAvatarIcon | null;
  avatarInitial?: string | null;
  learnerLevel?: number | null;
  unreadNotificationCount: number;
  weeklyPoints: number;
  profileHref?: string;
  className?: string;
  /** Replaces the avatar and greeting with a page title. */
  title?: string;
};

export function HomeGreetingHeader({
  displayName,
  profile,
  kidAvatarIcon,
  avatarInitial,
  learnerLevel,
  unreadNotificationCount,
  weeklyPoints,
  profileHref = "/dashboard/profile",
  className,
  title,
}: HomeGreetingHeaderProps) {
  if (title) {
    return (
      <header className={className ?? "mb-4"}>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-[28px] font-extrabold leading-8 tracking-tight text-zinc-900">{title}</h1>
            <HomeHeaderPills weeklyPoints={weeklyPoints} />
          </div>
          <NotificationBell unreadCount={unreadNotificationCount} />
        </div>
      </header>
    );
  }
  return (
    <header className={className ?? "mb-4"}>
      <div className="flex items-start gap-4">
        <Link href={profileHref} className="shrink-0" aria-label="Profile">
          {avatarInitial ? (
            <span
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold",
                ui.avatarKid
              )}
            >
              {avatarInitial}
            </span>
          ) : kidAvatarIcon ? (
            <span
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full",
                ui.avatarKid
              )}
            >
              <KidLucideIcon name={kidAvatarIcon} className="h-8 w-8" />
            </span>
          ) : (
            <UserAvatar profile={profile} level={learnerLevel} levelColor={learnerLevel == null ? null : levelFillVar(learnerLevel)} size="md" />
          )}
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
