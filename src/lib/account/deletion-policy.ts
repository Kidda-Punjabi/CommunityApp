const STAFF_ROLES = new Set(["tutor", "community_lead", "master_admin"]);

export function accountDeletionBlockedReason(
  roles: Array<string | null | undefined>,
  authAdmin: boolean
): string | null {
  if (authAdmin || roles.some((role) => STAFF_ROLES.has((role ?? "").trim()))) {
    return "Tutor and admin accounts can't be deleted here. Contact the Kidda team.";
  }
  return null;
}

export function normalizeDeleteConfirmation(value: string): boolean {
  return value.trim() === "DELETE";
}
