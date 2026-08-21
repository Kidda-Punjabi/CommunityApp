"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ProfileActionState = {
  error?: string;
  success?: boolean;
  profile?: {
    full_name: string | null;
    preferred_name: string | null;
  };
};

function migrationHint(message: string): string {
  if (message.includes("preferred_name") && message.includes("schema cache")) {
    return "The preferred_name column is missing. Run supabase/profile-avatars.sql in the Supabase SQL Editor, then try again.";
  }
  return message;
}

export async function updateProfile(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const fullNameRaw = (formData.get("full_name") as string | null) ?? "";
  const preferredNameRaw = (formData.get("preferred_name") as string | null) ?? "";
  const hadFullName = formData.get("had_full_name") === "true";

  const fullName = fullNameRaw.trim();
  const preferredName = preferredNameRaw.trim();

  if (hadFullName && !fullName) {
    return { error: "Name can't be empty." };
  }

  const payload = {
    full_name: fullName || null,
    preferred_name: preferredName || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...payload }, { onConflict: "id" })
    .select("full_name, preferred_name")
    .single();

  if (error) {
    return { error: migrationHint(error.message) };
  }

  if (!data) {
    return {
      error:
        "Profile could not be saved. Check that supabase/profile-avatars.sql has been run and that your account can update its profile row.",
    };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/profile/edit");
  revalidatePath("/dashboard/learn");
  revalidatePath("/dashboard/home");

  return {
    success: true,
    profile: {
      full_name: data.full_name,
      preferred_name: data.preferred_name,
    },
  };
}

export async function updateAvatarUrl(avatarUrl: string): Promise<ProfileActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("full_name, preferred_name")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (!data) {
    return { error: "Avatar URL could not be saved to your profile." };
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/profile/edit");
  revalidatePath("/dashboard/learn");
  revalidatePath("/dashboard/home");

  return { success: true };
}
