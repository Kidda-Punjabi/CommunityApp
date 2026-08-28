"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import {
  countPendingCohortSwitchRequests,
  loadAdminCohortSwitchRequests,
} from "@/lib/admin/load-admin-cohort-switch-requests";
import { enactSessionSwitchApproval } from "@/lib/calendar/enact-session-switch";
import { revalidatePath } from "next/cache";

const PATH = "/admin/cohort-switch-requests";

function revalidateSessionSwitchPaths() {
  revalidatePath(PATH);
  revalidatePath("/admin/content");
  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/learn");
}

export async function fetchAdminCohortSwitchRequests() {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminCohortSwitchRequests(supabase);
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load session switch requests.",
    };
  }
}

export async function fetchPendingCohortSwitchCount(): Promise<{
  count: number;
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return countPendingCohortSwitchRequests(supabase);
  } catch (e) {
    return {
      count: 0,
      error: e instanceof Error ? e.message : "Failed to count session switch requests.",
    };
  }
}

export async function resolveAdminCohortSwitchRequest(input: {
  requestId: string;
  decision: "approved" | "denied";
  adminResponse?: string;
}): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { createClient } = await import("@/lib/supabase/server");
    const auth = await createClient();
    const {
      data: { user: adminUser },
    } = await auth.auth.getUser();
    if (!adminUser) return { error: "Unauthorized" };

    const { data: request, error: requestError } = await supabase
      .from("cohort_switch_requests")
      .select("id, status, student_id, to_session_id, to_cohort_id")
      .eq("id", input.requestId)
      .maybeSingle();

    if (requestError || !request) return { error: "Request not found." };
    if (request.status !== "pending") return { error: "Already resolved." };

    if (input.decision === "approved" && !request.to_session_id) {
      return {
        error:
          "This request has no target class stored, so it cannot be approved. Ask the student to submit a new session switch.",
      };
    }

    const responseNote =
      input.adminResponse?.trim() ||
      (input.decision === "approved"
        ? "Your session switch was approved. We're updating your calendar invite."
        : null);

    const resolvedAt = input.decision === "denied" ? new Date().toISOString() : null;

    const { data: updated, error } = await supabase
      .from("cohort_switch_requests")
      .update({
        status: input.decision,
        tutor_response: responseNote,
        resolved_at: resolvedAt,
        resolved_by: adminUser.id,
        sync_error: null,
      })
      .eq("id", input.requestId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) return { error: error.message };
    if (!updated) {
      return { error: "Request was not updated. It may already have been resolved." };
    }

    if (input.decision === "denied") {
      revalidateSessionSwitchPaths();
      return { success: "Request declined." };
    }

    const enact = await enactSessionSwitchApproval(input.requestId, supabase);
    revalidateSessionSwitchPaths();

    if (!enact.ok) {
      return {
        error: `Approved, but calendar sync failed: ${enact.error} Retry from this page — the request is not fully confirmed until both calendar updates succeed.`,
      };
    }

    return {
      success: enact.alreadySynced
        ? "Approved — calendar was already updated."
        : "Approved — student removed from the original class and added to the target class calendar.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to resolve request." };
  }
}

export async function retryAdminSessionSwitchCalendar(requestId: string): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { data: request, error: requestError } = await supabase
      .from("cohort_switch_requests")
      .select("id, status, calendar_synced_at")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError || !request) return { error: "Request not found." };
    if (request.status !== "approved") {
      return { error: "Only approved session switches can retry calendar sync." };
    }
    if (request.calendar_synced_at) {
      return { success: "Calendar was already updated for this switch." };
    }

    const enact = await enactSessionSwitchApproval(requestId, supabase);
    revalidateSessionSwitchPaths();

    if (!enact.ok) {
      return { error: enact.error ?? "Calendar sync failed." };
    }

    return {
      success: "Calendar updated — student removed from the original class and added to the target class.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to retry calendar sync." };
  }
}
