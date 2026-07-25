import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { generateStorySceneImage } from "@/lib/kids/story-scene-image";
import { synthesizeSpeech } from "@/lib/elevenlabs/server";
import { PUNJABI_LESSON_VOICE_ID } from "@/lib/elevenlabs/constants";
import { getPronunciationDictionaryLocator } from "@/lib/elevenlabs/pronunciation-dictionary";

export const runtime = "nodejs";
export const maxDuration = 300;

const IMAGE_BUCKET = "story-scene-images";
const AUDIO_BUCKET = "story-sentence-audio";

/**
 * Admin-only Story 1 test batch runner (intended for Vercel US region when
 * local Gemini image generation is geo/quota blocked).
 *
 * POST /api/admin/story-sentence-media
 * body: { storyOrder?: number, mode?: "images" | "audio" | "both", force?: boolean }
 */
export async function POST(request: Request) {
  const batchSecret = process.env.STORY_MEDIA_BATCH_SECRET?.trim();
  const authHeader = request.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const secretOk = Boolean(batchSecret && bearer && bearer === batchSecret);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminOk = await canAccessAdminPanel(user, supabase);

  if (!secretOk && !adminOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    storyOrder?: number;
    mode?: "images" | "audio" | "both";
    force?: boolean;
  };
  const storyOrder = body.storyOrder ?? 1;
  const mode = body.mode ?? "both";
  const force = Boolean(body.force);

  if (storyOrder !== 1) {
    return NextResponse.json(
      {
        error:
          "Only storyOrder=1 is allowed until Gurupma approves the test batch.",
      },
      { status: 400 }
    );
  }

  const admin = createServiceRoleClient();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL" }, { status: 500 });
  }

  const { data: story, error: storyError } = await admin
    .from("kid_bedtime_stories")
    .select("id, title, display_order")
    .eq("display_order", storyOrder)
    .maybeSingle();

  if (storyError || !story) {
    return NextResponse.json(
      { error: storyError?.message ?? "Story not found" },
      { status: 404 }
    );
  }

  const { data: sentences, error: sentenceError } = await admin
    .from("story_sentences")
    .select(
      "id, sentence_order, text_gurmukhi, text_english, image_url, audio_url, audio_duration_ms"
    )
    .eq("story_id", story.id)
    .order("sentence_order", { ascending: true });

  if (sentenceError) {
    // audio columns may be missing — fall back
    const { data: fallback, error: fallbackError } = await admin
      .from("story_sentences")
      .select("id, sentence_order, text_gurmukhi, text_english, image_url")
      .eq("story_id", story.id)
      .order("sentence_order", { ascending: true });
    if (fallbackError) {
      return NextResponse.json({ error: fallbackError.message }, { status: 500 });
    }
    return await runBatch({
      admin,
      supabaseUrl,
      story,
      sentences: (fallback ?? []).map((row) => ({
        ...row,
        audio_url: null,
        audio_duration_ms: null,
      })),
      mode,
      force,
      audioColumnsReady: false,
    });
  }

  return await runBatch({
    admin,
    supabaseUrl,
    story,
    sentences: sentences ?? [],
    mode,
    force,
    audioColumnsReady: true,
  });
}

async function runBatch(options: {
  admin: ReturnType<typeof createServiceRoleClient>;
  supabaseUrl: string;
  story: { id: string; title: string; display_order: number };
  sentences: Array<{
    id: string;
    sentence_order: number;
    text_gurmukhi: string;
    text_english: string;
    image_url: string | null;
    audio_url: string | null;
    audio_duration_ms: number | null;
  }>;
  mode: "images" | "audio" | "both";
  force: boolean;
  audioColumnsReady: boolean;
}) {
  const { admin, supabaseUrl, story, sentences, mode, force, audioColumnsReady } = options;
  const doImage = mode === "images" || mode === "both";
  const doAudio = mode === "audio" || mode === "both";

  const pronunciation = await getPronunciationDictionaryLocator(admin);
  const locators = pronunciation ? [pronunciation] : undefined;

  const characterBible = [
    "Lion: large soft golden-orange mane, warm amber eyes, gentle smile when kind, rounded paws, friendly not scary.",
    "Mouse: tiny grey-brown body, big round ears, bright curious eyes, pink nose, same size relative to the lion in every scene.",
  ].join(" ");

  let firstRef: { mimeType: string; base64: string } | null = null;
  const items: Array<Record<string, unknown>> = [];
  let imagesGenerated = 0;
  let audioGenerated = 0;
  let audioChars = 0;
  let imageFailures = 0;
  let audioFailures = 0;

  for (const row of sentences) {
    const item: Record<string, unknown> = {
      sentence_order: row.sentence_order,
      english: row.text_english,
      gurmukhi: row.text_gurmukhi,
    };

    if (doImage) {
      if (row.image_url && !force) {
        item.image_url = row.image_url;
        item.image = "skipped_existing";
      } else {
        try {
          const generated = await generateStorySceneImage({
            sceneEnglish: row.text_english,
            storyTitle: story.title,
            characterBible,
            references: firstRef ? [firstRef] : [],
          });
          const ext = generated.mimeType.includes("jpeg")
            ? "jpg"
            : generated.mimeType.includes("webp")
              ? "webp"
              : "png";
          const path = `${story.id}/${String(row.sentence_order).padStart(2, "0")}-${row.id}.${ext}`;
          const { error: uploadError } = await admin.storage
            .from(IMAGE_BUCKET)
            .upload(path, generated.bytes, {
              contentType: generated.mimeType,
              upsert: true,
            });
          if (uploadError) throw new Error(uploadError.message);
          const imageUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
          await admin
            .from("story_sentences")
            .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          if (!firstRef) {
            firstRef = {
              mimeType: generated.mimeType,
              base64: generated.bytes.toString("base64"),
            };
          }
          item.image_url = imageUrl;
          item.image_model = generated.model;
          item.image = "generated";
          imagesGenerated++;
        } catch (error) {
          imageFailures++;
          item.image = "failed";
          item.image_error = error instanceof Error ? error.message : String(error);
        }
      }
    }

    if (doAudio) {
      if (row.audio_url && !force) {
        item.audio_url = row.audio_url;
        item.audio = "skipped_existing";
      } else {
        try {
          const synth = await synthesizeSpeech({
            text: row.text_gurmukhi,
            voiceId: PUNJABI_LESSON_VOICE_ID,
            pronunciationDictionaryLocators: locators,
          });
          const audioBytes = Buffer.from(synth.audio);
          const durationMs = Math.max(500, Math.round(((audioBytes.byteLength * 8) / 128_000) * 1000));
          const path = `${story.id}/${String(row.sentence_order).padStart(2, "0")}-${row.id}.mp3`;
          const { error: uploadError } = await admin.storage
            .from(AUDIO_BUCKET)
            .upload(path, audioBytes, {
              contentType: "audio/mpeg",
              upsert: true,
            });
          if (uploadError) throw new Error(uploadError.message);
          const audioUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${AUDIO_BUCKET}/${path}`;
          if (audioColumnsReady) {
            await admin
              .from("story_sentences")
              .update({
                audio_url: audioUrl,
                audio_duration_ms: durationMs,
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id);
          }
          item.audio_url = audioUrl;
          item.audio_duration_ms = durationMs;
          item.chars = synth.normalizedText.length;
          item.audio = "generated";
          audioGenerated++;
          audioChars += synth.normalizedText.length;
        } catch (error) {
          audioFailures++;
          item.audio = "failed";
          item.audio_error = error instanceof Error ? error.message : String(error);
        }
      }
    }

    items.push(item);
  }

  return NextResponse.json({
    storyId: story.id,
    title: story.title,
    displayOrder: story.display_order,
    audioColumnsReady,
    imagesGenerated,
    imageFailures,
    audioGenerated,
    audioFailures,
    elevenLabsCharacters: audioChars,
    estimatedCostUsd: {
      geminiImages: Number((imagesGenerated * 0.039).toFixed(4)),
      elevenLabsAudio: Number(((audioChars / 1000) * 0.18).toFixed(4)),
    },
    items,
  });
}
