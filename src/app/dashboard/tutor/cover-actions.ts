"use server";

import { revalidatePath } from "next/cache";
import {
  autoConfirmExpiredCoverAssignments,
  createCoverRequest,
  declineCoverAssignment,
} from "@/lib/calendar/tutor-cover";
import { canAccessTutorDashboard } from "@/lib/tutoring/tutor-access";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { getDisplayName } from "@/lib/profile/display-name";

export type CoverActionResult = { error?: string; success?: string };

export async function requestSessionCover(
  _prev: CoverActionResult,
  formData: FormData
): Promise<CoverActionResult> {
  const sessionId = String(formData.get("session_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!sessionId) return { error: "Missing session." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const allowed = await canAccessTutorDashboard(supabase, user.id);
  if (!allowed) return { error: "Tutor access required." };

  const { client: admin, error: adminError } = tryCreateServiceRoleClient();
  if (!admin) return { error: adminError };

  const result = await createCoverRequest(admin, {
    sessionId,
    requestingTutorId: user.id,
    reason: reason || null,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/dashboard/tutor");
  revalidatePath("/dashboard/tutor/calendar");
  revalidatePath("/dashboard/tutor/requests");
  return {
    success:
      "Cover requested. An available tutor has been assigned (or flagged for admin if none are free). They have 48 hours to decline.",
  };
}

export async function declineAssignedCover(
  _prev: CoverActionResult,
  formData: FormData
): Promise<CoverActionResult> {
  const coverRequestId = String(formData.get("cover_request_id") ?? "").trim();
  const reason = String(formData.get("decline_reason") ?? "").trim();
  if (!coverRequestId) return { error: "Missing cover request." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { client: admin, error: adminError } = tryCreateServiceRoleClient();
  if (!admin) return { error: adminError };

  const result = await declineCoverAssignment(admin, {
    coverRequestId,
    tutorId: user.id,
    reason: reason || null,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/dashboard/tutor/requests");
  revalidatePath("/dashboard/tutor/calendar");
  return {
    success: "Declined. The system will try another available tutor (or flag admin if none).",
  };
}

export type TutorCoverInboxItem = {
  id: string;
  status: string;
  sessionTitle: string;
  sessionStartsAt: string;
  sessionEndsAt: string;
  decisionDeadline: string | null;
  reason: string | null;
  requestingTutorName: string;
  assignedTutorName: string | null;
  role: "requesting" | "assigned";
};

export async function loadTutorCoverInbox(tutorId: string): Promise<{
  items: TutorCoverInboxItem[];
  error?: string;
}> {
  try {
    const { client: admin, error: adminError } = tryCreateServiceRoleClient();
    if (!admin) return { items: [], error: adminError };

    // Auto-confirm any expired assignments while loading
    await autoConfirmExpiredCoverAssignments(admin);

    const { data, error } = await admin
      .from("tutor_cover_requests")
      .select(
        "id, status, reason, decision_deadline, requesting_tutor_id, assigned_tutor_id, tutor_scheduled_sessions(title, starts_at, ends_at)"
      )
      .or(`requesting_tutor_id.eq.${tutorId},assigned_tutor_id.eq.${tutorId}`)
      .in("status", ["pending_assignment", "assigned", "confirmed", "needs_admin"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      if (error.message.includes("tutor_cover_requests")) {
        return { items: [], error: "Cover requests table not applied yet." };
      }
      return { items: [], error: error.message };
    }

    const tutorIds = [
      ...new Set(
        (data ?? []).flatMap((row) =>
          [row.requesting_tutor_id, row.assigned_tutor_id].filter(Boolean)
        )
      ),
    ] as string[];

    const { data: profiles } =
      tutorIds.length > 0
        ? await admin
            .from("profiles")
            .select("id, full_name, preferred_name")
            .in("id", tutorIds)
        : { data: [] };

    const nameById = new Map(
      (profiles ?? []).map((p) => [p.id, getDisplayName(p) ?? "Tutor"] as const)
    );

    const items: TutorCoverInboxItem[] = (data ?? []).map((row) => {
      const session = Array.isArray(row.tutor_scheduled_sessions)
        ? row.tutor_scheduled_sessions[0]
        : row.tutor_scheduled_sessions;
      return {
        id: row.id,
        status: row.status,
        sessionTitle: session?.title ?? "Lesson",
        sessionStartsAt: session?.starts_at ?? "",
        sessionEndsAt: session?.ends_at ?? "",
        decisionDeadline: row.decision_deadline,
        reason: row.reason,
        requestingTutorName: nameById.get(row.requesting_tutor_id) ?? "Tutor",
        assignedTutorName: row.assigned_tutor_id
          ? (nameById.get(row.assigned_tutor_id) ?? "Tutor")
          : null,
        role: row.assigned_tutor_id === tutorId ? "assigned" : "requesting",
      };
    });

    return { items };
  } catch (e) {
    return {
      items: [],
      error: e instanceof Error ? e.message : "Failed to load cover requests.",
    };
  }
}
