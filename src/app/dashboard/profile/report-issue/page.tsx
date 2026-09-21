import { ReportIssueForm } from "@/components/profile/report-issue-form";
import { requireNoActiveKidProfile } from "@/lib/kids/guards";
import { getDisplayName, getStaffFacingName } from "@/lib/profile/display-name";

export default async function ReportIssuePage() {
  const { user, supabase } = await requireNoActiveKidProfile();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name")
    .eq("id", user.id)
    .maybeSingle();

  const fullName =
    getStaffFacingName(profile) ?? getDisplayName(profile) ?? user.email ?? "Kidda user";

  return <ReportIssueForm fullName={fullName} email={user.email ?? ""} />;
}
