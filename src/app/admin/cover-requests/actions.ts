"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { assignCoverTutor } from "@/lib/calendar/tutor-cover";
import { revalidatePath } from "next/cache";

const PATH = "/admin/cover-requests";

export async function retryAdminCoverAssignment(coverRequestId: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const result = await assignCoverTutor(supabase, coverRequestId);
    if (!result.ok) return { error: result.error };

    revalidatePath(PATH);
    revalidatePath("/dashboard/tutor/requests");
    return {
      success:
        result.status === "needs_admin"
          ? "Still no available tutor found."
          : "Cover assignment retried.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to retry assignment." };
  }
}
