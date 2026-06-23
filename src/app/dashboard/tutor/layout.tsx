import { TutorBottomNav } from "@/components/tutor/tutor-bottom-nav";
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

  return (
    <div className={`flex min-h-0 flex-1 flex-col bg-violet-50/40 ${ui.navClearance}`}>
      {children}
      <TutorBottomNav />
    </div>
  );
}
