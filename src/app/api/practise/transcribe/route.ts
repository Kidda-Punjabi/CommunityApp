import { NextResponse } from "next/server";
import { transcribeSpeech, userFacingSpeechToTextError } from "@/lib/elevenlabs/speech-to-text";
import { createClient } from "@/lib/supabase/server";

const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

/** Press-and-hold speaking in Practise. Separate from the Games route and its monthly cap. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "Missing audio recording." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "That was a bit long. Try a shorter clip." }, { status: 400 });

  const keyterms = [form?.get("target_romanised"), form?.get("target_punjabi")]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
  try {
    const result = await transcribeSpeech(audio, { languageCode: "pan", keyterms: keyterms.length ? keyterms : undefined });
    return NextResponse.json({ transcript: result.text });
  } catch (error) {
    return NextResponse.json({ error: userFacingSpeechToTextError(error) }, { status: 502 });
  }
}
