import Link from "next/link";
import { ProfileSwitcher } from "@/components/kids/profile-switcher";
import { requireNoActiveKidProfile } from "@/lib/kids/guards";
import { getDisplayName } from "@/lib/profile/display-name";
import { ui } from "@/lib/ui/styles";

export default async function KidsProfileSwitcherPage() {
  const { user, supabase } = await requireNoActiveKidProfile();

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
      <Link
        href="/dashboard/profile"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to profile
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-zinc-900">Kids Mode</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Switch to a kid profile for a simpler, kid-friendly experience on your membership.
      </p>
      <div className="mt-6">
        <ProfileSwitcher
          kidProfiles={kidProfiles ?? []}
          hasPin={Boolean(profile?.kids_pin_hash)}
          parentName={parentName}
        />
      </div>
    </div>
  );
}
