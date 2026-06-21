import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadEditableProfile } from "@/lib/profile/load-editable-profile";
import { EditProfileForm } from "./edit-profile-form";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await loadEditableProfile(supabase, user!.id);

  return (
    <div className="flex flex-1 flex-col px-6 py-8">
      <Link
        href="/dashboard/profile"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Back to profile
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">Edit profile</h1>
      <p className="mt-1 text-sm text-zinc-500">Update your name and profile photo.</p>

      <div className="mt-8">
        <EditProfileForm
          userId={user!.id}
          profile={{
            full_name: profile?.full_name ?? null,
            preferred_name: profile?.preferred_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
          }}
          learnerLevel={profile?.learner_level ?? null}
        />
      </div>
    </div>
  );
}
