import { ProfileSwitcher } from "@/components/kids/profile-switcher";
import { loadKidSession } from "@/lib/kids/session";
import { getDisplayName } from "@/lib/profile/display-name";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function KidsProfileSwitcherPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const kidSession = await loadKidSession(user.id);
  const activeKidProfileId = kidSession.activeKidProfile?.id ?? null;

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
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-zinc-900">
        Who&apos;s learning?
      </h1>
      <p className="mt-2 text-center text-sm text-zinc-500">
        {activeKidProfileId
          ? "Pick a profile to switch. Grown-up account needs the PIN."
          : "Choose who is using the app."}
      </p>
      <div className="mt-12">
        <ProfileSwitcher
          kidProfiles={kidProfiles ?? []}
          hasPin={Boolean(profile?.kids_pin_hash)}
          parentName={parentName}
          activeKidProfileId={activeKidProfileId}
          allowCreate={activeKidProfileId === null}
          pickedWhoThisSession={kidSession.pickedWhoThisSession}
        />
      </div>
    </div>
  );
}
