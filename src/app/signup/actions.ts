"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { AuthState } from "@/app/login/actions";

export async function signup(
  _prevState: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!fullName || !email || !password) {
    return { error: "All fields are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  // Profile row is created by the handle_new_user DB trigger using user metadata.
  // Upsert here when a session is returned (email confirmation disabled).
  if (data.user && data.session) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
    });
    redirect("/dashboard");
  }

  redirect("/login?message=Check your email to confirm your account.");
}
