import { TutorBottomNav } from "@/components/tutor/tutor-bottom-nav";
import { TutorAdminPanelBar } from "@/components/tutor/tutor-admin-panel-link";
import { TutorSetupBanner } from "@/components/tutor/tutor-setup-banner";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { loadTutorSetupStatus } from "@/lib/tutoring/tutor-setup-status";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function TutorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) redirect("/dashboard/profile");

  const [showAdminPanel, setupStatus] = await Promise.all([
    canAccessAdminPanel(user, supabase),
    loadTutorSetupStatus(supabase, user.id),
  ]);

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${ui.navClearance}`}>
      {setupStatus.showPrompt ? <TutorSetupBanner /> : null}
      {showAdminPanel ? <TutorAdminPanelBar /> : null}
      {children}
      <TutorBottomNav />
    </div>
  );
}
