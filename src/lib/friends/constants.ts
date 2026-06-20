export type NotificationType =
  | "friend_request"
  | "friend_request_accepted"
  | "friend_level_up"
  | "kudos"
  | "announcement"
  | "friend_game_challenge"
  | "friend_game_challenge_result";

export type FriendRequestStatus = "pending" | "accepted" | "declined";

export type FriendshipSource = "request" | "referral";

export type UserLookupRelationship = "none" | "friends" | "pending";
