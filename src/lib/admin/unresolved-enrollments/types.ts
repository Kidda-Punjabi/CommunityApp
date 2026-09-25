export type UnresolvedEnrollmentCategory = "A" | "B" | "C" | "D" | "E" | "G" | "H";

export type UnresolvedEnrollmentKid = {
  name: string;
  active: boolean;
};

export type UnresolvedEnrollmentAccount = {
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  created_at: string | null;
  enrolled_in: string | null;
};

export type UnresolvedEnrollmentRow = {
  row_key: string;
  category: UnresolvedEnrollmentCategory;
  target_kind: "cohort" | "package_instance";
  target_id: string;
  target_name: string;
  target_status: string;
  person_name: string;
  email: string | null;
  user_id: string | null;
  notion_lead_page_id: string | null;
  notion_package_page_id: string | null;
  kid_profile_id: string | null;
  detail: string | null;
  kids: UnresolvedEnrollmentKid[] | null;
  duplicate_accounts: {
    this: UnresolvedEnrollmentAccount;
    other: UnresolvedEnrollmentAccount;
  } | null;
};

export const UNRESOLVED_CATEGORY_LABELS: Record<UnresolvedEnrollmentCategory, string> = {
  A: "Confirmed, not enrolled",
  B: "Link account and enroll",
  C: "No app account",
  D: "Partial chain",
  E: "In the app, not Confirmed",
  G: "Possible duplicate account",
  H: "Notion data issue",
};

export function closeEnrollmentIsHeld(row: UnresolvedEnrollmentRow): boolean {
  return (row.detail ?? "").includes("Close enrollment is waiting");
}
