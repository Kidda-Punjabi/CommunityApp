import { TutorBottomNav } from "@/components/tutor/tutor-bottom-nav";
import { TutorAdminPanelBarLink } from "@/components/tutor/tutor-admin-panel-link";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
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

  const showAdminPanel = await canAccessAdminPanel(user, supabase);

  return (
    <div className={`flex min-h-0 flex-1 flex-col bg-violet-50/40 ${ui.navClearance}`}>
      {showAdminPanel ? (
        <div className="border-b border-violet-200/60 bg-white/90">
          <div className="mx-auto flex max-w-lg justify-end px-5 py-2.5">
            <TutorAdminPanelBarLink />
          </div>
        </div>
      ) : null}
      {children}
      <TutorBottomNav />
    </div>
  );
}
