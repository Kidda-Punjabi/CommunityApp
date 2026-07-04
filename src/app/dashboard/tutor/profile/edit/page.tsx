import { BackLink } from "@/components/navigation/back-link";
import { loadTutorProfileForEdit } from "@/lib/tutoring/load-tutor-profile";
import { createClient } from "@/lib/supabase/server";
import { TutorProfileEditForm } from "./tutor-profile-edit-form";

export default async function TutorProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = await loadTutorProfileForEdit(supabase, user!.id);

  return (
    <div className="flex flex-1 flex-col px-5 py-7">
      <BackLink
        fallbackHref="/dashboard/tutor/profile"
        className="text-sm font-medium text-violet-600 hover:text-violet-500"
      >
        ← Tutor profile
      </BackLink>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">Edit tutor profile</h1>
      <p className="mt-1 text-sm text-zinc-500">Add your photo and a short bio for students.</p>

      <div className="mt-8">
        <TutorProfileEditForm
          userId={user!.id}
          profile={{
            full_name: profile?.full_name ?? null,
            preferred_name: profile?.preferred_name ?? null,
            avatar_url: profile?.avatar_url ?? null,
            tutor_bio: profile?.tutor_bio ?? null,
          }}
        />
      </div>
    </div>
  );
}
