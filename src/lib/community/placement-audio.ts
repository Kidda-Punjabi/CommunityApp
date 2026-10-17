import { createHash } from "node:crypto";
import { PUNJABI_LESSON_TTS_MODEL_ID, PUNJABI_LESSON_VOICE_ID } from "@/lib/elevenlabs/constants";
import { getPronunciationDictionaryLocator } from "@/lib/elevenlabs/pronunciation-dictionary";
import { normalizeScriptText } from "@/lib/elevenlabs/normalize-script";
import { synthesizeSpeech } from "@/lib/elevenlabs/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type Clip = { itemId: string; level: number; optionId: string; gurmukhi: string };

export function placementClips(items: { id: string; level: number; gurmukhi: string | null; options: { id: string; gurmukhi?: string | null }[] | null }[]): Clip[] {
  const clips: Clip[] = [];
  for (const item of items) {
    if (item.gurmukhi?.trim()) clips.push({ itemId: item.id, level: item.level, optionId: "prompt", gurmukhi: item.gurmukhi.trim() });
    for (const option of item.options ?? []) {
      if (option.gurmukhi?.trim()) clips.push({ itemId: item.id, level: item.level, optionId: option.id, gurmukhi: option.gurmukhi.trim() });
    }
  }
  return clips;
}

export function placementSpeed(level: number): number {
  return level <= 3 ? 0.85 : 1;
}

export async function generatePlacementClips(admin: SupabaseClient, onlyItemId?: string) {
  const { data: items, error } = await admin
    .from("placement_test_items")
    .select("id, level, gurmukhi, options")
    .order("level")
    .order("sort_order");
  if (error) return { error: error.message };
  const clips = placementClips((items ?? []) as ClipSource[]).filter((clip) => !onlyItemId || clip.itemId === onlyItemId);
  const review = clips.flatMap((clip) => {
    const report = normalizeScriptText(clip.gurmukhi);
    const serious = report.issues.filter((issue) => issue.includes("zero-width") || issue.includes("invisible"));
    return serious.map((issue) => `${clip.itemId} ${clip.optionId}: ${issue}`);
  });
  if (review.length) return { error: "These lines need a review before I generate them.", review };

  const locator = await getPronunciationDictionaryLocator(admin);
  let created = 0;
  for (const clip of clips) {
    const hash = createHash("sha256").update(clip.gurmukhi).digest("hex").slice(0, 16);
    const path = `${clip.itemId}/${clip.optionId}/${PUNJABI_LESSON_VOICE_ID}-${hash}.mp3`;
    const speech = await synthesizeSpeech({
      text: clip.gurmukhi,
      voiceId: PUNJABI_LESSON_VOICE_ID,
      voiceSettings: { speed: placementSpeed(clip.level) },
      pronunciationDictionaryLocators: locator ? [locator] : undefined,
    });
    const upload = await admin.storage.from("placement-audio").upload(path, Buffer.from(speech.audio), {
      contentType: "audio/mpeg",
      upsert: true,
    });
    if (upload.error) return { error: upload.error.message, itemId: clip.itemId };
    const { error: rowError } = await admin.from("placement_test_audio").upsert(
      {
        item_id: clip.itemId,
        option_id: clip.optionId,
        voice_id: PUNJABI_LESSON_VOICE_ID,
        model_id: PUNJABI_LESSON_TTS_MODEL_ID,
        gurmukhi_hash: hash,
        storage_path: path,
        approved: false,
      },
      { onConflict: "item_id,option_id,voice_id,gurmukhi_hash" }
    );
    if (rowError) return { error: rowError.message, itemId: clip.itemId };
    created += 1;
  }
  return { created };
}

type ClipSource = { id: string; level: number; gurmukhi: string | null; options: { id: string; gurmukhi?: string | null }[] | null };
