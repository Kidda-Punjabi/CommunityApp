import { FloatingSoundToggle } from "@/components/audio/floating-sound-toggle";
import { loadKidSession } from "@/lib/kids/session";
import { KID_PROFILE_PICKER_PATH, usesKidsShell } from "@/lib/kids/constants";
import { planRedirect } from "@/lib/navigation/redirect-guard";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
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
    const pathname = (await headers()).get("x-pathname") || "/dashboard/kids";
    const next = planRedirect({
      currentPath: pathname,
      destination: KID_PROFILE_PICKER_PATH,
      redirectsAlreadyIssued: 0,
    });
    if (next) redirect(next);
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <FloatingSoundToggle placement="top-left" />
      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-12">{children}</div>
    </div>
  );
}
