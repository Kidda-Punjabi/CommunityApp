import { EnglishBottomNav } from "@/components/english/english-bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";
import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";

export default async function EnglishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const privateCourses = await fetchAccessiblePrivateCourses(supabase, user.id);
  const hasAccess = privateCourses.length > 0;

  if (!hasAccess) {
    redirect("/dashboard/learn");
  }

  return (
    <div className={`flex min-h-dvh flex-1 flex-col bg-emerald-50/40 ${ui.navClearance}`}>
      <div className="relative isolate mx-auto flex w-full max-w-lg flex-1 flex-col bg-emerald-50/40">
        {children}
      </div>
      <EnglishBottomNav />
    </div>
  );
}
