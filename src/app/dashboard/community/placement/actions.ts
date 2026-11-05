"use server";

import { revalidatePath } from "next/cache";
import { requireCommunityMember } from "@/lib/community/member-guard";
import { answerPlacement, beginPlacement } from "@/lib/community/placement-run";
import { rejectIfKidCommunityBlocked } from "@/lib/kids/guards";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";

/** Everyone finds their level from Practice, so a placement only needs a signed-in learner. Retakes stay in Community. */
async function requireLearner() {
  const blocked = await rejectIfKidCommunityBlocked();
  if (blocked.blocked) return { error: blocked.error as string };
  return { userId: blocked.user.id, admin: createServiceRoleClient() };
}

export async function startLevelTest(understand: number, reply: number, purpose: "placement" | "retake" = "placement") {
  const learner = purpose === "retake" ? await requireCommunityMember() : await requireLearner();
  if ("error" in learner) return { error: learner.error };
  return beginPlacement(learner.admin, learner.userId, understand, reply, purpose);
}

export async function submitLevelAnswer(attemptId: string, itemId: string, optionId: string) {
  const learner = await requireLearner();
  if ("error" in learner) return { error: learner.error };
  const result = await answerPlacement(learner.admin, learner.userId, attemptId, itemId, optionId);
  if ("scores" in result) {
    revalidatePath("/dashboard/community");
    revalidatePath("/dashboard/home");
  }
  return result;
}
