import type { AppRole } from "@/lib/auth/admin-access";

export function formatRoleList(roles: AppRole[]): string {
  if (roles.length === 0) return "Member";
  return roles
    .map((role) =>
      role === "community_lead"
        ? "Community lead"
        : role === "master_admin"
          ? "Master admin"
          : role.charAt(0).toUpperCase() + role.slice(1)
    )
    .join(", ");
}

export function hasAnyRole(userRoles: AppRole[], allowed: AppRole[]): boolean {
  return allowed.some((role) => userRoles.includes(role));
}
