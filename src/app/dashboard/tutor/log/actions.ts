"use server";

import { logTutorLessonSweep, retryTutorLessonNotion } from "@/lib/tutoring/log-lesson-sweep";
import type { LogLessonSweepInput, LogLessonSweepResult } from "@/lib/tutoring/log-lesson-sweep";
import { loadLogLessonCatalog } from "@/lib/tutoring/load-log-lesson-catalog";
import type { LogLessonCatalog } from "@/lib/tutoring/load-log-lesson-catalog";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireTutor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." as const };
  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) return { error: "Tutor access required." as const };
  return { supabase, userId: user.id };
}

export async function loadAllClassesCatalogAction(
  includeTest: boolean
): Promise<LogLessonCatalog | { error: string }> {
  const auth = await requireTutor();
  if ("error" in auth && auth.error) return { error: auth.error };
  const { client: admin } = tryCreateServiceRoleClient();
  return loadLogLessonCatalog(admin ?? auth.supabase!, auth.userId!, {
    includeTest,
    allClasses: true,
  });
}

export async function saveTutorLessonAction(
  input: LogLessonSweepInput
): Promise<LogLessonSweepResult> {
  const auth = await requireTutor();
  if ("error" in auth && auth.error) {
    return {
      ok: false,
      error: auth.error,
      entryId: null,
      headline: "",
      slotLabel: "",
      targetName: "",
      unlockedCount: 0,
      readback: null,
      differences: [],
      confirmed: false,
      readAt: "",
      notionError: null,
    };
  }
  const result = await logTutorLessonSweep(auth.supabase!, auth.userId!, input);
  if (result.ok) {
    revalidatePath("/dashboard/tutor");
    revalidatePath("/dashboard/tutor/log");
    revalidatePath("/dashboard/tutor/lessons");
  }
  return result;
}

export async function retryTutorLessonSyncAction(entryId: string): Promise<LogLessonSweepResult> {
  const auth = await requireTutor();
  if ("error" in auth && auth.error) {
    return {
      ok: false,
      error: auth.error,
      entryId: null,
      headline: "",
      slotLabel: "",
      targetName: "",
      unlockedCount: 0,
      readback: null,
      differences: [],
      confirmed: false,
      readAt: "",
      notionError: null,
    };
  }
  return retryTutorLessonNotion(auth.supabase!, auth.userId!, entryId);
}
