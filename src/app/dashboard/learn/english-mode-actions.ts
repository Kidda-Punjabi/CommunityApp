"use server";

import {
  LEARN_ENGLISH_MODE_COOKIE,
  learnEnglishModeCookieOptions,
} from "@/lib/learning/learn-english-mode";
import { fetchAccessiblePrivateCourses } from "@/lib/learning/private-courses";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

async function assertHasPrivateCourseAccess(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const privateCourses = await fetchAccessiblePrivateCourses(supabase, user.id);
  return privateCourses.length > 0;
}

export async function enableLearnEnglishMode() {
  if (!(await assertHasPrivateCourseAccess())) {
    redirect("/dashboard/learn");
  }

  const cookieStore = await cookies();
  cookieStore.set(LEARN_ENGLISH_MODE_COOKIE, "1", learnEnglishModeCookieOptions());
  revalidatePath("/dashboard/learn");
  redirect("/dashboard/learn/english");
}

export async function disableLearnEnglishMode() {
  const cookieStore = await cookies();
  cookieStore.delete(LEARN_ENGLISH_MODE_COOKIE);
  revalidatePath("/dashboard/learn");
  redirect("/dashboard/learn");
}
