import { KidsExitButton } from "@/components/kids/kids-exit-button";
import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { KidsShellNav } from "@/components/kids/kids-shell-nav";
import { loadKidSession } from "@/lib/kids/session";
import { usesKidsShell } from "@/lib/kids/constants";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function KidsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const session = await loadKidSession(user.id);
  const kid = session.activeKidProfile;

  if (!kid || !usesKidsShell(kid.age_tier)) {
    redirect("/dashboard/profile/kids");
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-100 via-violet-50 to-amber-50 pb-24">
      <KidsExitButton />
      <FloatingSoundToggle placement="top-left" />
      <div className="mx-auto max-w-lg px-4 pt-12">{children}</div>
      <KidsShellNav ageTier={kid.age_tier} />
    </div>
  );
}
