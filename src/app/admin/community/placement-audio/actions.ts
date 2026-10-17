"use server";

import { revalidatePath } from "next/cache";
import { generatePlacementClips } from "@/lib/community/placement-audio";
import { requireCommunityStaff } from "@/lib/community/member-guard";

export async function generatePlacementAudio(itemId?: string) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const result = await generatePlacementClips(staff.admin, itemId);
  revalidatePath("/admin/community/placement-audio");
  return result;
}

export async function approvePlacementClip(clipId: string, approved: boolean) {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const { error } = await staff.admin.from("placement_test_audio").update({ approved }).eq("id", clipId);
  if (error) return { error: error.message };
  revalidatePath("/admin/community/placement-audio");
  return { ok: true as const };
}
