export const LEAD_HEAL_KIDS_COURSE_REASON = "lead_heal_kids_course";

type KidRow = { id: string; name: string };

export type LeadHealKidPick =
  | { status: "grant"; kidProfileId: string }
  | { status: "wait" }
  | { status: "ambiguous" };

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * A lead-heal row has no Stripe session. It identifies a child only when the
 * queue row names one profile, or the parent has exactly one profile.
 * Several profiles and no name or id stay unresolved.
 */
export function pickLeadHealKidProfile(
  kids: KidRow[],
  hint: { kidProfileId?: string | null; kidName?: string | null }
): LeadHealKidPick {
  const explicitId = hint.kidProfileId?.trim() || "";
  if (explicitId) {
    return kids.some((kid) => kid.id === explicitId)
      ? { status: "grant", kidProfileId: explicitId }
      : { status: "ambiguous" };
  }

  const name = hint.kidName?.trim() ? normalizeName(hint.kidName) : "";
  if (name) {
    const matches = kids.filter((kid) => normalizeName(kid.name) === name);
    if (matches.length === 1) return { status: "grant", kidProfileId: matches[0]!.id };
    return { status: "ambiguous" };
  }

  if (kids.length === 1) return { status: "grant", kidProfileId: kids[0]!.id };
  if (kids.length === 0) return { status: "wait" };
  return { status: "ambiguous" };
}

export function leadHealKidsQueueSessionId(
  profileId: string,
  kind: string,
  runId: string
): string {
  return `lead-heal:${profileId}:${kind}:${runId}`;
}
