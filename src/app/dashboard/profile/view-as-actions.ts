"use server";

import { isAdmin } from "@/lib/auth/admin";
import type { PaidCourseTier } from "@/lib/membership/access";
import { VIEW_AS_COOKIE } from "@/lib/membership/view-as";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const VIEW_AS_PATHS = [
  "/dashboard",
  "/dashboard/home",
  "/dashboard/learn",
  "/dashboard/practice",
  "/dashboard/profile",
  "/dashboard/membership",
  "/dashboard/community",
];

function revalidateDashboard() {
  revalidatePath("/dashboard", "layout");
  for (const path of VIEW_AS_PATHS) {
    revalidatePath(path);
  }
}

export async function setViewAsCourses(tiers: PaidCourseTier[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    return { error: "Only admins can use test access." };
  }

  const cookieStore = await cookies();
  cookieStore.set(VIEW_AS_COOKIE, JSON.stringify(tiers), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidateDashboard();
  return { success: true };
}

export async function resetViewAsCourses() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isAdmin(user)) {
    return { error: "Only admins can use test access." };
  }

  const cookieStore = await cookies();
  cookieStore.delete(VIEW_AS_COOKIE);

  revalidateDashboard();
  return { success: true };
}
