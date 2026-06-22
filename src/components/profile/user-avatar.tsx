import { getAvatarInitial } from "@/lib/profile/display-name";
import type { ProfileNameFields } from "@/lib/profile/display-name";

type UserAvatarProps = {
  profile: ProfileNameFields & { avatar_url?: string | null };
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** Learner level (1–8). Shows a purple badge on the bottom-right when set. */
  level?: number | null;
};

const SIZE_CLASSES = {
  xs: "h-8 w-8 text-xs",
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-xl",
  lg: "h-24 w-24 text-3xl",
} as const;

const BADGE_CLASSES = {
  xs: "h-3.5 min-w-3.5 px-0.5 text-[9px] -bottom-0.5 -right-0.5 ring-[1.5px]",
  sm: "h-4 min-w-4 px-0.5 text-[10px] -bottom-0.5 -right-0.5 ring-[1.5px]",
  md: "h-5 min-w-5 px-0.5 text-[11px] -bottom-0.5 -right-0.5 ring-2",
  lg: "h-7 min-w-7 px-1 text-xs -bottom-1 -right-1 ring-2",
} as const;

const ICON_CLASSES = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  );
}

function LevelBadge({ level, size }: { level: number; size: keyof typeof SIZE_CLASSES }) {
  return (
    <span
      className={`absolute flex items-center justify-center rounded-full bg-violet-600 font-bold leading-none text-white ring-white ${BADGE_CLASSES[size]}`}
      aria-hidden="true"
    >
      {level}
    </span>
  );
}

export function UserAvatar({
  profile,
  size = "lg",
  className = "",
  level,
}: UserAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const initial = getAvatarInitial(profile);
  const showLevel = level != null && level > 0;

  const content = profile.avatar_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
  ) : (
    <div
      className="flex h-full w-full items-center justify-center bg-zinc-200 font-semibold text-zinc-600"
      aria-hidden="true"
    >
      {initial ? <span>{initial}</span> : <PersonIcon className={ICON_CLASSES[size]} />}
    </div>
  );

  return (
    <div className={`relative inline-flex shrink-0 rounded-full ${sizeClass} ${className}`}>
      <div className="h-full w-full overflow-hidden rounded-full">{content}</div>
      {showLevel && <LevelBadge level={level} size={size} />}
    </div>
  );
}
