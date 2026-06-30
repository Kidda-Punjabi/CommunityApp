"use server";

import { LAST_USER_COOKIE } from "@/lib/auth/last-user";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function switchAccount() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(LAST_USER_COOKIE);

  redirect("/login");
}
