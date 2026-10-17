"use server";

import { revalidatePath } from "next/cache";
import { requireCommunityMember } from "@/lib/community/member-guard";
import { answerPlacement, beginPlacement } from "@/lib/community/placement-run";

export async function startLevelTest(understand: number, reply: number) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  return beginPlacement(member.admin, member.userId, understand, reply);
}

export async function submitLevelAnswer(attemptId: string, itemId: string, optionId: string) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const result = await answerPlacement(member.admin, member.userId, attemptId, itemId, optionId);
  if ("scores" in result) revalidatePath("/dashboard/community");
  return result;
}
