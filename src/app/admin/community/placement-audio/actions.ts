"use server";

import { createHash } from "node:crypto";
import { PUNJABI_CONVERSATION_PLAYER_VOICE_ID, PUNJABI_LESSON_VOICE_ID } from "@/lib/elevenlabs/constants";
import { synthesizeSpeech } from "@/lib/elevenlabs/server";
import { requireCommunityStaff } from "@/lib/community/member-guard";

const VOICES = [
  { id: PUNJABI_LESSON_VOICE_ID, label: "Yatin" },
  { id: PUNJABI_CONVERSATION_PLAYER_VOICE_ID, label: "Noor" },
];

export async function generateLevel1Samples() {
  const staff = await requireCommunityStaff();
  if ("error" in staff) return { error: staff.error };
  const { data: items, error } = await staff.admin
    .from("placement_test_items")
    .select("id, gurmukhi, options")
    .eq("level", 1);
  if (error) return { error: error.message };

  let created = 0;
  for (const item of items ?? []) {
    const clips: { optionId: string | null; gurmukhi: string }[] = [];
    if (item.gurmukhi) clips.push({ optionId: null, gurmukhi: item.gurmukhi as string });
    for (const option of (item.options ?? []) as { id: string; gurmukhi?: string }[]) {
      if (option.gurmukhi) clips.push({ optionId: option.id, gurmukhi: option.gurmukhi });
    }
    for (const clip of clips) {
      for (const voice of VOICES) {
        const hash = createHash("sha256").update(clip.gurmukhi).digest("hex").slice(0, 16);
        const path = `${item.id}/${clip.optionId ?? "line"}/${voice.id}-${hash}.mp3`;
        const speech = await synthesizeSpeech({
          text: clip.gurmukhi,
          voiceId: voice.id,
          voiceSettings: { speed: 0.85 },
        });
        const upload = await staff.admin.storage.from("placement-audio").upload(path, Buffer.from(speech.audio), {
          contentType: "audio/mpeg",
          upsert: true,
        });
        if (upload.error) return { error: upload.error.message };
        const { error: rowError } = await staff.admin.from("placement_test_audio").upsert(
          {
            item_id: item.id,
            option_id: clip.optionId ?? "prompt",
            voice_id: voice.id,
            model_id: "eleven_v3",
            gurmukhi_hash: hash,
            storage_path: path,
            approved: false,
          },
          { onConflict: "item_id,option_id,voice_id,gurmukhi_hash" }
        );
        if (rowError) return { error: rowError.message };
        created += 1;
      }
    }
  }
  return { created };
}
