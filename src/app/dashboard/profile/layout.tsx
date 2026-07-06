import { kidHomeHref } from "@/lib/kids/load-kid-content";
import { loadKidSession } from "@/lib/kids/session";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProfileSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const session = await loadKidSession(user.id);
  if (session.activeKidProfile) {
    redirect(kidHomeHref(session.activeKidProfile.age_tier));
  }

  return children;
}
