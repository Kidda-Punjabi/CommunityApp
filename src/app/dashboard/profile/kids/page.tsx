import { ProfileSwitcher } from "@/components/kids/profile-switcher";
import { loadKidSession } from "@/lib/kids/session";
import { getDisplayName } from "@/lib/profile/display-name";
import { createClient } from "@/lib/supabase/server";
import { ui } from "@/lib/ui/styles";
import { redirect } from "next/navigation";

export default async function KidsProfileSwitcherPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kidSession = await loadKidSession(user.id);
  const kidActive = kidSession.activeKidProfile !== null;

  const { data: kidProfiles } = await supabase
    .from("kid_profiles")
    .select("*")
    .eq("parent_user_id", user.id)
    .order("created_at", { ascending: true });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name, kids_pin_hash")
    .eq("id", user.id)
    .single();

  const parentName = getDisplayName(profile) ?? user.email?.split("@")[0] ?? "Parent";

  return (
    <div className={`flex min-h-dvh flex-col items-center justify-center px-6 py-12 ${ui.pageBg}`}>
      <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">
        Who&apos;s learning?
      </h1>
      <div className="mt-12">
        <ProfileSwitcher
          kidProfiles={kidProfiles ?? []}
          hasPin={Boolean(profile?.kids_pin_hash)}
          parentName={parentName}
          kidActive={kidActive}
        />
      </div>
    </div>
  );
}
