import { getAvatarInitial } from "@/lib/profile/display-name";
import type { ProfileNameFields } from "@/lib/profile/display-name";

type UserAvatarProps = {
  profile: ProfileNameFields & { avatar_url?: string | null };
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASSES = {
  sm: "h-10 w-10 text-sm",
  md: "h-16 w-16 text-xl",
  lg: "h-24 w-24 text-3xl",
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

export function UserAvatar({ profile, size = "lg", className = "" }: UserAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const initial = getAvatarInitial(profile);

  if (profile.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt=""
        className={`rounded-full object-cover ${sizeClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 ${sizeClass} ${className}`}
      aria-hidden="true"
    >
      {initial ? (
        <span>{initial}</span>
      ) : (
        <PersonIcon className={size === "sm" ? "h-5 w-5" : size === "md" ? "h-8 w-8" : "h-10 w-10"} />
      )}
    </div>
  );
}
