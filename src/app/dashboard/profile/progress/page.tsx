import { ProgressDetail } from "@/components/profile/progress-detail";
import { loadUserProgression } from "@/lib/progression/load-user-progression";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProfileProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const progression = await loadUserProgression(supabase, user.id);

  return <ProgressDetail progression={progression} />;
}
