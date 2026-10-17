"use server";

import { requireCommunityMember } from "@/lib/community/member-guard";

export async function checkRefresherAnswer(itemId: string, optionId: string) {
  const member = await requireCommunityMember();
  if ("error" in member) return { error: member.error };
  const { data, error } = await member.admin.from("placement_test_items").select("options").eq("id", itemId).maybeSingle();
  if (error || !data) return { error: "That practice item is missing." };
  const options = (data.options as { id: string; correct?: boolean }[]) ?? [];
  const correct = options.find((option) => option.correct);
  return { correct: options.some((option) => option.id === optionId && option.correct), correctOptionId: correct?.id ?? optionId };
}
