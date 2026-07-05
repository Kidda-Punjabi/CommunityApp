import { APP_ROLE_LABELS, type AppRole } from "@/lib/auth/admin-access";

type StaffRoleBadgeProps = {
  roles: AppRole[];
  className?: string;
};

/** Highlights tutor / community staff on forum posts and replies. */
export function StaffRoleBadge({ roles, className = "" }: StaffRoleBadgeProps) {
  const displayRoles = roles.filter(
    (role) => role === "tutor" || role === "community_lead" || role === "master_admin"
  );

  if (displayRoles.length === 0) return null;

  const primary = displayRoles.includes("tutor")
    ? "tutor"
    : displayRoles.includes("community_lead")
      ? "community_lead"
      : displayRoles[0];

  return (
    <span
      className={`inline-flex shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 ${className}`}
    >
      {APP_ROLE_LABELS[primary]}
    </span>
  );
}
