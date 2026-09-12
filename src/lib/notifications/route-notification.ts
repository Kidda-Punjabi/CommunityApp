import type { NotificationType } from "@/lib/friends/constants";

export type NotificationAudience = "both" | "kid_only" | "parent_only" | "never_kid";

export const NOTIFICATION_ROUTING = {
  homework_reviewed: "both",
  cohort_switch_requested: "both",
  cohort_switch_resolved: "both",
  lesson_reschedule_requested: "both",
  lesson_reschedule_resolved: "both",
  tutor_cover_assigned: "both",
  certificate_issued: "both",
  cohort_new_student: "kid_only",
  announcement: "parent_only",
  student_discount_approved: "parent_only",
  student_discount_rejected: "parent_only",
  cohort_placement_pending: "parent_only",
  friend_request: "never_kid",
  friend_request_accepted: "never_kid",
  friend_level_up: "never_kid",
  kudos: "never_kid",
  friend_game_challenge: "never_kid",
  friend_game_challenge_result: "never_kid",
} as const satisfies Record<NotificationType, NotificationAudience>;

export type NotificationInsertRow = {
  user_id: string | null;
  kid_profile_id: string | null;
};

export type RouteNotificationInput = {
  type: NotificationType;
  /** Adult student, or parent when the event is already known to be about a kid. */
  userId?: string | null;
  kidProfileId?: string | null;
  /** Required when inserting a parent row for a kid event and userId is not the parent. */
  parentUserId?: string | null;
};

/**
 * Plan XOR-safe notification rows.
 * Never returns a row with both user_id and kid_profile_id set.
 */
export function planNotificationInserts(input: RouteNotificationInput): NotificationInsertRow[] {
  const audience = NOTIFICATION_ROUTING[input.type];
  const kidProfileId = input.kidProfileId?.trim() || null;
  const parentUserId = input.parentUserId?.trim() || input.userId?.trim() || null;
  const adultUserId = kidProfileId ? null : input.userId?.trim() || null;

  if (audience === "never_kid") {
    if (kidProfileId) return [];
    if (!adultUserId) return [];
    return [{ user_id: adultUserId, kid_profile_id: null }];
  }

  if (audience === "parent_only") {
    const userId = input.userId?.trim() || parentUserId;
    if (!userId) return [];
    return [{ user_id: userId, kid_profile_id: null }];
  }

  if (audience === "kid_only") {
    if (kidProfileId) {
      return [{ user_id: null, kid_profile_id: kidProfileId }];
    }
    if (adultUserId) {
      return [{ user_id: adultUserId, kid_profile_id: null }];
    }
    return [];
  }

  if (kidProfileId) {
    if (!parentUserId) return [];
    return [
      { user_id: parentUserId, kid_profile_id: null },
      { user_id: null, kid_profile_id: kidProfileId },
    ];
  }

  if (adultUserId) {
    return [{ user_id: adultUserId, kid_profile_id: null }];
  }

  return [];
}
