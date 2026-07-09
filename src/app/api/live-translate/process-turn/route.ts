import { NextResponse } from "next/server";
import { PUNJABI_LESSON_VOICE_ID } from "@/lib/elevenlabs/constants";
import { getPronunciationDictionaryLocator } from "@/lib/elevenlabs/pronunciation-dictionary";
import { synthesizeSpeech } from "@/lib/elevenlabs/server";
import { transcribeSpeech } from "@/lib/elevenlabs/speech-to-text";
import { canAccessLiveTranslate } from "@/lib/live-translate/access";
import { LIVE_TRANSLATE_MONTHLY_CAP_SECONDS } from "@/lib/live-translate/config";
import { resolveTranslationDirection } from "@/lib/live-translate/direction";
import { currentMonthKeyUtc } from "@/lib/live-translate/month-key";
import { translateLiveUtterance } from "@/lib/live-translate/translate";
import {
  capReachedMessage,
  incrementLiveTranslateUsage,
  loadLiveTranslateUsage,
} from "@/lib/live-translate/usage";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import type { LiveTranslateSide } from "@/lib/live-translate/config";

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_DURATION_SECONDS = 30;

function parseActiveSide(value: FormDataEntryValue | null): LiveTranslateSide | null {
  const side = String(value ?? "").trim();
  if (side === "member" || side === "other") return side;
  return null;
}

function parseDurationSeconds(value: FormDataEntryValue | null): number {
  const parsed = Number(String(value ?? "").trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(parsed, MAX_DURATION_SECONDS);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString("base64");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await getCourseAccessContext(supabase, user);
  if (!canAccessLiveTranslate(access)) {
    return NextResponse.json(
      { error: "Live Translate is available on paid Kidda plans." },
      { status: 403 }
    );
  }

  const { client: adminClient, error: adminError } = tryCreateServiceRoleClient();
  if (!adminClient) {
    return NextResponse.json({ error: adminError }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const audio = formData.get("audio");
  const activeSide = parseActiveSide(formData.get("active_side"));
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Missing audio recording." }, { status: 400 });
  }
  if (!activeSide) {
    return NextResponse.json({ error: "Missing active side." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Recording is too long — try a shorter phrase." }, { status: 400 });
  }

  const durationSeconds = parseDurationSeconds(formData.get("duration_seconds"));
  const monthKey = currentMonthKeyUtc();

  let usage;
  try {
    usage = await loadLiveTranslateUsage(adminClient, user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load usage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (usage.secondsUsed >= LIVE_TRANSLATE_MONTHLY_CAP_SECONDS) {
    return NextResponse.json(
      {
        error: "cap_reached",
        message: capReachedMessage(usage.resetsOn),
        seconds_remaining_this_month: 0,
        seconds_used_this_month: usage.secondsUsed,
        month_key: monthKey,
        resets_on: usage.resetsOn,
      },
      { status: 429 }
    );
  }

  if (usage.secondsUsed + durationSeconds > LIVE_TRANSLATE_MONTHLY_CAP_SECONDS) {
    return NextResponse.json(
      {
        error: "cap_reached",
        message: capReachedMessage(usage.resetsOn),
        seconds_remaining_this_month: usage.secondsRemaining,
        seconds_used_this_month: usage.secondsUsed,
        month_key: monthKey,
        resets_on: usage.resetsOn,
      },
      { status: 429 }
    );
  }

  try {
    const stt = await transcribeSpeech(audio, {
      languageCode: activeSide === "member" ? "en" : "pan",
    });

    const direction = resolveTranslationDirection({
      languageCode: stt.languageCode,
      activeSide,
      transcript: stt.text,
    });

    const translatedText = await translateLiveUtterance(stt.text, direction);

    let audioBase64: string | null = null;
    if (direction === "en-to-pa") {
      const pronunciationDictionaryLocators = await getPronunciationDictionaryLocator(adminClient);
      const tts = await synthesizeSpeech({
        text: translatedText,
        voiceId: PUNJABI_LESSON_VOICE_ID,
        pronunciationDictionaryLocators: pronunciationDictionaryLocators
          ? [pronunciationDictionaryLocators]
          : undefined,
      });
      audioBase64 = arrayBufferToBase64(tts.audio);
    }

    const updatedUsage = await incrementLiveTranslateUsage(adminClient, user.id, durationSeconds);

    return NextResponse.json({
      original_text: stt.text,
      translated_text: translatedText,
      audio_base64: audioBase64,
      direction,
      side: activeSide,
      language_code: stt.languageCode,
      seconds_remaining_this_month: updatedUsage.secondsRemaining,
      seconds_used_this_month: updatedUsage.secondsUsed,
      month_key: updatedUsage.monthKey,
      resets_on: updatedUsage.resetsOn,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live Translate failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const access = await getCourseAccessContext(supabase, user);
  if (!canAccessLiveTranslate(access)) {
    return NextResponse.json(
      { error: "Live Translate is available on paid Kidda plans." },
      { status: 403 }
    );
  }

  const { client: adminClient, error: adminError } = tryCreateServiceRoleClient();
  if (!adminClient) {
    return NextResponse.json({ error: adminError }, { status: 500 });
  }

  try {
    const usage = await loadLiveTranslateUsage(adminClient, user.id);
    return NextResponse.json({
      seconds_remaining_this_month: usage.secondsRemaining,
      seconds_used_this_month: usage.secondsUsed,
      month_key: usage.monthKey,
      resets_on: usage.resetsOn,
      cap_seconds: usage.capSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load usage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
