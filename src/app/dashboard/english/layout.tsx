import { EnglishBottomNav } from "@/components/english/english-bottom-nav";
import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { getCachedAuthSession } from "@/lib/supabase/cached-session";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function EnglishLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCachedAuthSession();
  if (!session) redirect("/login");

  const privateCourses = await fetchAccessiblePrivateCourses(
    session.supabase,
    session.user.id
  );

  if (privateCourses.length === 0) {
    redirect("/dashboard/profile");
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col bg-emerald-50/40 ${ui.navClearance}`}>
      <div className="relative isolate mx-auto flex w-full max-w-lg flex-1 flex-col">
        {children}
      </div>
      <EnglishBottomNav />
    </div>
  );
}
