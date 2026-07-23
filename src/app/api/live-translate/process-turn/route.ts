import { NextResponse } from "next/server";
import { PUNJABI_LESSON_VOICE_ID } from "@/lib/elevenlabs/constants";
import { getPronunciationDictionaryLocator } from "@/lib/elevenlabs/pronunciation-dictionary";
import { synthesizeSpeech } from "@/lib/elevenlabs/server";
import { transcribeSpeech } from "@/lib/elevenlabs/speech-to-text";
import { canAccessLiveTranslate } from "@/lib/live-translate/access";
import { LIVE_TRANSLATE_MONTHLY_CAP_SECONDS } from "@/lib/live-translate/config";
import { currentMonthKeyUtc } from "@/lib/live-translate/month-key";
import {
  directionFromSpokenLanguage,
  isNonSpeechTranscript,
  sttLanguageCode,
  type LiveTranslateSpokenLanguage,
} from "@/lib/live-translate/speech";
import { translateLiveUtterance } from "@/lib/live-translate/translate";
import {
  capReachedMessage,
  incrementLiveTranslateUsage,
  loadLiveTranslateUsage,
} from "@/lib/live-translate/usage";
import { getCourseAccessContext } from "@/lib/membership/unlocked";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 8 * 1024 * 1024;
const MAX_DURATION_SECONDS = 30;

type StreamEvent = Record<string, unknown>;

function parseSpokenLanguage(
  value: FormDataEntryValue | null
): LiveTranslateSpokenLanguage | null {
  const language = String(value ?? "").trim();
  if (language === "en" || language === "pan") return language;
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

function ndjsonStream(writeEvents: (emit: (event: StreamEvent) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await writeEvents(emit);
      } catch (error) {
        emit({
          stage: "error",
          error: error instanceof Error ? error.message : "Live Translate failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
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
  const spokenLanguage = parseSpokenLanguage(
    formData.get("language_code") ?? formData.get("spoken_language")
  );
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Missing audio recording." }, { status: 400 });
  }
  if (!spokenLanguage) {
    return NextResponse.json(
      { error: "Missing language_code (en or pan)." },
      { status: 400 }
    );
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Recording is too long — try a shorter phrase." },
      { status: 400 }
    );
  }

  const durationSeconds = parseDurationSeconds(formData.get("duration_seconds"));
  const monthKey = currentMonthKeyUtc();
  const direction = directionFromSpokenLanguage(spokenLanguage);

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

  return ndjsonStream(async (emit) => {
    emit({
      stage: "hearing",
      direction,
      language_code: spokenLanguage,
    });

    const stt = await transcribeSpeech(audio, {
      languageCode: sttLanguageCode(spokenLanguage),
    });

    if (isNonSpeechTranscript(stt.text)) {
      emit({
        stage: "skipped",
        reason: "non_speech",
        direction,
        language_code: spokenLanguage,
        seconds_remaining_this_month: usage.secondsRemaining,
        seconds_used_this_month: usage.secondsUsed,
        month_key: usage.monthKey,
        resets_on: usage.resetsOn,
      });
      return;
    }

    emit({
      stage: "transcript",
      original_text: stt.text,
      direction,
      language_code: spokenLanguage,
    });

    emit({ stage: "translating" });
    const translatedText = await translateLiveUtterance(stt.text, direction);
    emit({
      stage: "translated",
      translated_text: translatedText,
    });

    let audioBase64: string | null = null;
    if (direction === "en-to-pa") {
      emit({ stage: "speaking" });
      const pronunciationDictionaryLocators = await getPronunciationDictionaryLocator(
        adminClient
      );
      const tts = await synthesizeSpeech({
        text: translatedText,
        voiceId: PUNJABI_LESSON_VOICE_ID,
        pronunciationDictionaryLocators: pronunciationDictionaryLocators
          ? [pronunciationDictionaryLocators]
          : undefined,
      });
      audioBase64 = arrayBufferToBase64(tts.audio);
    }

    const updatedUsage = await incrementLiveTranslateUsage(
      adminClient,
      user.id,
      durationSeconds
    );

    emit({
      stage: "done",
      original_text: stt.text,
      translated_text: translatedText,
      audio_base64: audioBase64,
      direction,
      language_code: spokenLanguage,
      seconds_remaining_this_month: updatedUsage.secondsRemaining,
      seconds_used_this_month: updatedUsage.secondsUsed,
      month_key: updatedUsage.monthKey,
      resets_on: updatedUsage.resetsOn,
    });
  });
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
