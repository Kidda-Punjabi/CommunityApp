import { BackLink } from "@/components/navigation/back-link";
import { TutorSetupChecklist } from "@/components/tutor/tutor-setup-checklist";
import { TutorPageHeader } from "@/components/tutor/tutor-page-header";
import { loadTutorSetupStatus } from "@/lib/tutoring/tutor-setup-status";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function TutorSetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const status = await loadTutorSetupStatus(supabase, user!.id);

  if (!status.showPrompt) {
    redirect("/dashboard/tutor/profile");
  }

  return (
    <div className={ui.page}>
      <BackLink
        fallbackHref="/dashboard/tutor/profile"
        className="mb-4 text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Tutor profile
      </BackLink>

      <TutorPageHeader
        title="Tutor setup"
        subtitle="Work through these steps so your profile is ready for students."
      />

      <TutorSetupChecklist status={status} variant="page" />
    </div>
  );
}
