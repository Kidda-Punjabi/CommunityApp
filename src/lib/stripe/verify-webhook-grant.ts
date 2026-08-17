import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type WebhookGrantVerification = {
  isComplete: boolean;
  hasCohortMember: boolean;
  hasCourseEnrollment: boolean;
  hasStudentPackage: boolean;
  hasProfileCourseAccess: boolean;
  missingRecords: string[];
};

/**
 * Verify whether a user has all 4 downstream access records that should
 * result from a successful course purchase grant:
 * 1. cohort_members (if group purchase)
 * 2. course_enrollments
 * 3. student_packages
 * 4. profile_course_access
 *
 * This is the ground truth for determining if a webhook grant was actually completed.
 */
export async function verifyWebhookGrantCompletion(
  supabase: SupabaseClient,
  profileId: string,
  options?: {
    /** Check for specific cohort membership */
    cohortId?: string;
    /** Check for specific course */
    courseId?: string;
  }
): Promise<WebhookGrantVerification> {
  const missingRecords: string[] = [];

  // 1. Check cohort_members (if cohortId specified, otherwise just check for any active membership)
  const cohortQuery = supabase
    .from("cohort_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profileId)
    .is("left_at", null);

  if (options?.cohortId) {
    cohortQuery.eq("cohort_id", options.cohortId);
  }

  const { count: cohortCount } = await cohortQuery;
  const hasCohortMember = (cohortCount ?? 0) > 0;

  // 2. Check course_enrollments
  const enrollmentQuery = supabase
    .from("course_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profileId);

  if (options?.courseId) {
    enrollmentQuery.eq("course_id", options.courseId);
  }
  if (options?.cohortId) {
    enrollmentQuery.eq("cohort_id", options.cohortId);
  }

  const { count: enrollmentCount } = await enrollmentQuery;
  const hasCourseEnrollment = (enrollmentCount ?? 0) > 0;
  if (!hasCourseEnrollment) {
    missingRecords.push("course_enrollments");
  }

  // 3. Check student_packages
  const packageQuery = supabase
    .from("student_packages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profileId)
    .eq("status", "confirmed");

  if (options?.courseId) {
    packageQuery.eq("course_id", options.courseId);
  }

  const { count: packageCount } = await packageQuery;
  const hasStudentPackage = (packageCount ?? 0) > 0;
  if (!hasStudentPackage) {
    missingRecords.push("student_packages");
  }

  // 4. Check profile_course_access
  const accessQuery = supabase
    .from("profile_course_access")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  if (options?.courseId) {
    accessQuery.eq("course_id", options.courseId);
  }

  const { count: accessCount } = await accessQuery;
  const hasProfileCourseAccess = (accessCount ?? 0) > 0;
  if (!hasProfileCourseAccess) {
    missingRecords.push("profile_course_access");
  }

  // For group purchases, cohort membership is critical
  // For 1-1 or self-paced, cohort membership is not required
  // We'll flag it as info but not mark as incomplete unless other records are missing
  if (options?.cohortId && !hasCohortMember) {
    missingRecords.push("cohort_members");
  }

  const isComplete =
    hasCourseEnrollment &&
    hasStudentPackage &&
    hasProfileCourseAccess &&
    (!options?.cohortId || hasCohortMember);

  return {
    isComplete,
    hasCohortMember,
    hasCourseEnrollment,
    hasStudentPackage,
    hasProfileCourseAccess,
    missingRecords,
  };
}

/**
 * Find all webhook events with pending/failed grant status and attempt to verify them.
 * Returns events that need admin attention (still incomplete after verification).
 */
export async function findUnmatchedWebhookGrants(
  supabase: SupabaseClient,
  options?: {
    /** Only check events older than this many minutes */
    minAgeMinutes?: number;
    /** Max retry count before giving up */
    maxRetries?: number;
    /** Limit number of events to check */
    limit?: number;
  }
): Promise<
  Array<{
    eventId: string;
    sessionId: string | null;
    email: string | null;
    profileId: string | null;
    grantStatus: string;
    retryCount: number;
    lastRetry: string | null;
    receivedAt: string;
    payloadSummary: Record<string, unknown>;
    verification: WebhookGrantVerification | null;
  }>
> {
  const minAgeMinutes = options?.minAgeMinutes ?? 5;
  const maxRetries = options?.maxRetries ?? 10;
  const limit = options?.limit ?? 50;

  const cutoff = new Date(Date.now() - minAgeMinutes * 60 * 1000).toISOString();

  const { data: events, error } = await supabase
    .from("stripe_webhook_events")
    .select(
      "id, checkout_session_id, grant_email, grant_profile_id, grant_status, grant_retry_count, grant_last_retry_at, received_at, payload_summary"
    )
    .in("grant_status", ["pending", "failed", "needs_retry"])
    .lt("received_at", cutoff)
    .lt("grant_retry_count", maxRetries)
    .order("received_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[webhook grant] failed to load unmatched events:", error.message);
    return [];
  }

  const results = await Promise.all(
    (events ?? []).map(async (event) => {
      let verification: WebhookGrantVerification | null = null;

      // If we have a profile, verify completion
      if (event.grant_profile_id) {
        const summary = event.payload_summary as Record<string, unknown>;
        const cohortId = (summary?.checkout_key as string)?.includes("cohort")
          ? (summary?.cohort_id as string)
          : undefined;

        verification = await verifyWebhookGrantCompletion(
          supabase,
          event.grant_profile_id,
          cohortId ? { cohortId } : undefined
        );
      }

      return {
        eventId: event.id,
        sessionId: event.checkout_session_id,
        email: event.grant_email,
        profileId: event.grant_profile_id,
        grantStatus: event.grant_status,
        retryCount: event.grant_retry_count,
        lastRetry: event.grant_last_retry_at,
        receivedAt: event.received_at,
        payloadSummary: event.payload_summary as Record<string, unknown>,
        verification,
      };
    })
  );

  return results;
}
