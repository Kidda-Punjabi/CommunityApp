import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
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
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <FloatingSoundToggle placement="top-left" />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-12">{children}</div>
    </div>
  );
}
