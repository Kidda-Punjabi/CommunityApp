import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FriendRequestStatus,
  FriendshipSource,
  UserLookupRelationship,
} from "@/lib/friends/constants";

export type FriendListItem = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  source: FriendshipSource;
  since: string;
  learnerLevel: number | null;
};

export type FriendRequestItem = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
  otherUserId: string;
  otherDisplayName: string;
  otherAvatarUrl: string | null;
  direction: "incoming" | "outgoing";
};

export type UserLookupResult = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  referralCode: string;
  relationship: UserLookupRelationship;
};

type ProfileSnippet = {
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
  learner_level?: number | null;
};

function unwrapProfile(
  row: ProfileSnippet | ProfileSnippet[] | null
): ProfileSnippet | null {
  if (!row) return null;
  return Array.isArray(row) ? (row[0] ?? null) : row;
}

function isMissingFriendsSchema(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("friendships") ||
    lower.includes("friend_requests") ||
    lower.includes("send_friend_request")
  );
}

export async function loadFriends(
  supabase: SupabaseClient,
  userId: string
): Promise<FriendListItem[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select(
      `
      friend_user_id,
      source,
      created_at,
      friend:friend_user_id (
        full_name,
        preferred_name,
        avatar_url,
        learner_level
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingFriendsSchema(error.message)) return [];
    throw error;
  }

  return (data ?? []).map((row) => {
    const friend = unwrapProfile(row.friend as ProfileSnippet | ProfileSnippet[] | null);
    return {
      userId: row.friend_user_id as string,
      displayName: getDisplayName(friend) ?? "Friend",
      avatarUrl: friend?.avatar_url ?? null,
      source: row.source as FriendshipSource,
      since: row.created_at as string,
      learnerLevel: friend?.learner_level ?? null,
    };
  });
}

export async function loadFriendRequests(
  supabase: SupabaseClient,
  userId: string
): Promise<FriendRequestItem[]> {
  const { data, error } = await supabase
    .from("friend_requests")
    .select(
      `
      id,
      from_user_id,
      to_user_id,
      status,
      created_at,
      from_user:from_user_id (full_name, preferred_name, avatar_url),
      to_user:to_user_id (full_name, preferred_name, avatar_url)
    `
    )
    .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingFriendsSchema(error.message)) return [];
    throw error;
  }

  return (data ?? []).map((row) => {
    const incoming = row.to_user_id === userId;
    const other = unwrapProfile(
      (incoming ? row.from_user : row.to_user) as ProfileSnippet | ProfileSnippet[] | null
    );
    return {
      id: row.id as string,
      fromUserId: row.from_user_id as string,
      toUserId: row.to_user_id as string,
      status: row.status as FriendRequestStatus,
      createdAt: row.created_at as string,
      otherUserId: incoming ? (row.from_user_id as string) : (row.to_user_id as string),
      otherDisplayName: getDisplayName(other) ?? "Member",
      otherAvatarUrl: other?.avatar_url ?? null,
      direction: incoming ? "incoming" : "outgoing",
    };
  });
}

export async function lookupUserByReferralCode(
  supabase: SupabaseClient,
  code: string
): Promise<UserLookupResult | null> {
  const { data, error } = await supabase.rpc("lookup_user_by_referral_code", {
    p_code: code.trim(),
  });

  if (error) {
    if (isMissingFriendsSchema(error.message)) return null;
    throw error;
  }

  if (!data) return null;

  const row = data as {
    user_id: string;
    full_name: string | null;
    preferred_name: string | null;
    avatar_url: string | null;
    referral_code: string;
    relationship: UserLookupRelationship;
  };

  return {
    userId: row.user_id,
    displayName: getDisplayName(row) ?? "Member",
    avatarUrl: row.avatar_url,
    referralCode: row.referral_code,
    relationship: row.relationship,
  };
}

export type FriendsProfileData = {
  friends: FriendListItem[];
  requests: FriendRequestItem[];
  unavailable: boolean;
};

export async function loadFriendsProfileData(
  supabase: SupabaseClient,
  userId: string
): Promise<FriendsProfileData> {
  try {
    const [friends, requests] = await Promise.all([
      loadFriends(supabase, userId),
      loadFriendRequests(supabase, userId),
    ]);
    return { friends, requests, unavailable: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isMissingFriendsSchema(message)) {
      return { friends: [], requests: [], unavailable: true };
    }
    throw error;
  }
}
