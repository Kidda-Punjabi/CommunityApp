"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TutorProfileActionState = {
  error?: string;
  success?: boolean;
  tutorBio?: string | null;
};

const MIN_BIO_LENGTH = 20;

function migrationHint(message: string): string {
  if (message.includes("tutor_bio") && message.includes("schema cache")) {
    return "The tutor_bio column is missing. Run supabase/tutor-setup-onboarding.sql in the Supabase SQL Editor, then try again.";
  }
  return message;
}

const TUTOR_PATHS = [
  "/dashboard/tutor",
  "/dashboard/tutor/profile",
  "/dashboard/tutor/profile/edit",
  "/dashboard/tutor/setup",
  "/dashboard/tutor/calendar",
];

function revalidateTutorSetupPaths() {
  for (const path of TUTOR_PATHS) {
    revalidatePath(path);
  }
}

export async function updateTutorBio(
  _prev: TutorProfileActionState,
  formData: FormData
): Promise<TutorProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const bioRaw = (formData.get("tutor_bio") as string | null) ?? "";
  const bio = bioRaw.trim();

  if (bio.length < MIN_BIO_LENGTH) {
    return {
      error: `Please write at least ${MIN_BIO_LENGTH} characters — a couple of sentences about yourself.`,
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        tutor_bio: bio,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("tutor_bio")
    .single();

  if (error) {
    return { error: migrationHint(error.message) };
  }

  if (!data) {
    return { error: "Bio could not be saved." };
  }

  revalidateTutorSetupPaths();

  return { success: true, tutorBio: data.tutor_bio };
}

export async function updateTutorAvatarUrl(avatarUrl: string): Promise<TutorProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    return { error: error.message };
  }

  revalidateTutorSetupPaths();
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/profile/edit");

  return { success: true };
}
