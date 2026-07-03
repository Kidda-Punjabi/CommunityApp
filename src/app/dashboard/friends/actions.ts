"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error?: string; success?: string };

export async function sendFriendRequestByCode(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const code = String(formData.get("invite_code") ?? "").trim();
  if (!code) return { error: "Enter an invite code." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("send_friend_request_by_code", {
    p_referral_code: code,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/profile/friends");
  revalidatePath("/dashboard/friends");
  return { success: "Friend request sent!" };
}

export async function respondFriendRequest(
  requestId: string,
  accept: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_friend_request", {
    p_request_id: requestId,
    p_accept: accept,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/profile/friends");
  revalidatePath("/dashboard/friends");
  revalidatePath("/dashboard/notifications");
  return { success: accept ? "Friend added!" : "Request declined." };
}

export async function removeFriend(friendUserId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_friend", {
    p_friend_user_id: friendUserId,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/profile/friends");
  revalidatePath("/dashboard/friends");
  return { success: "Friend removed." };
}

export async function lookupFriendByCode(code: string) {
  const supabase = await createClient();
  const { lookupUserByReferralCode } = await import("@/lib/friends/load-friends");
  return lookupUserByReferralCode(supabase, code);
}
