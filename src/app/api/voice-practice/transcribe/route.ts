import { NextResponse } from "next/server";
import {
  transcribeSpeech,
  userFacingSpeechToTextError,
} from "@/lib/elevenlabs/speech-to-text";
import { VOICE_PRACTICE_MONTHLY_LIMIT } from "@/lib/games/voice-practice-stt";
import { createClient } from "@/lib/supabase/server";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

type LimitResult = {
  allowed: boolean;
  attempt_count: number;
  remaining: number;
  limit: number;
  month_key: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Missing audio recording." }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: "Recording is too long — try a shorter clip." },
      { status: 400 }
    );
  }

  const rawSentenceId = String(formData.get("sentence_id") ?? "").trim();
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const sentenceId = uuidPattern.test(rawSentenceId) ? rawSentenceId : null;
  const targetRomanised = String(formData.get("target_romanised") ?? "").trim() || null;
  const targetPunjabi = String(formData.get("target_punjabi") ?? "").trim() || null;
  const keyterms = [targetRomanised, targetPunjabi].filter(Boolean) as string[];

  const { data: limitData, error: limitError } = await supabase.rpc(
    "check_and_increment_voice_practice_attempt",
    {
      p_user_id: user.id,
      p_sentence_id: sentenceId,
    }
  );

  if (limitError) {
    return NextResponse.json({ error: limitError.message }, { status: 500 });
  }

  const limit = limitData as LimitResult;

  if (!limit.allowed) {
    return NextResponse.json({
      allowed: false,
      limitReached: true,
      message: `You've used all ${VOICE_PRACTICE_MONTHLY_LIMIT} Speak It transcriptions for this month. Come back next month!`,
      attempt_count: limit.attempt_count,
      remaining: 0,
      limit: limit.limit,
      month_key: limit.month_key,
    });
  }

  try {
    const result = await transcribeSpeech(audio, {
      languageCode: "pan",
      keyterms: keyterms.length > 0 ? keyterms : undefined,
    });

    return NextResponse.json({
      allowed: true,
      limitReached: false,
      transcript: result.text,
      language_code: result.languageCode,
      attempt_count: limit.attempt_count,
      remaining: limit.remaining,
      limit: limit.limit,
      month_key: limit.month_key,
    });
  } catch (error) {
    return NextResponse.json(
      { error: userFacingSpeechToTextError(error) },
      { status: 502 }
    );
  }
}
