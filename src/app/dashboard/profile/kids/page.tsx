import Link from "next/link";
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
    <div className={ui.page}>
      {kidActive ? null : (
        <Link
          href="/dashboard/profile"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← Back to profile
        </Link>
      )}
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">Who is learning?</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Pick a profile to continue. You can switch anytime from the avatar in the corner.
      </p>
      <div className="mt-6">
        <ProfileSwitcher
          kidProfiles={kidProfiles ?? []}
          hasPin={Boolean(profile?.kids_pin_hash)}
          parentName={parentName}
          kidActive={kidActive}
          showManage={!kidActive}
        />
      </div>
    </div>
  );
}
