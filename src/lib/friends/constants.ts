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
  | "cohort_new_student";

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export type FriendshipSource = "request" | "referral";

export type UserLookupRelationship = "none" | "friends" | "pending";
