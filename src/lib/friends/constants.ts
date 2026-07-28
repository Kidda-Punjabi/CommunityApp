export type NotificationType =
  | "friend_request"
  | "friend_request_accepted"
  | "friend_level_up"
  | "kudos"
  | "announcement"
  | "friend_game_challenge"
  | "friend_game_challenge_result"
  | "homework_reviewed"
  | "student_discount_approved"
  | "student_discount_rejected"
  | "cohort_placement_pending"
  | "cohort_new_student"
  | "tutor_cover_assigned"
  | "cohort_switch_requested"
  | "cohort_switch_resolved"
  | "lesson_reschedule_requested"
  | "lesson_reschedule_resolved";

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export type FriendshipSource = "request" | "referral";

export type UserLookupRelationship = "none" | "friends" | "pending";
