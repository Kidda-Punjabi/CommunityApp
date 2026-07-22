/**
 * Spike: Live Translate STT auto-detect (no language_code hint).
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/spike-live-translate-autodetect.ts
 *
 * Requires ELEVENLABS_API_KEY. Uses TTS → STT round-trips plus transcript/direction
 * scenarios for code-switching (direction logic only on text cases).
 */
import { resolveTranslationDirectionWithSource } from "../src/lib/live-translate/direction";
import { synthesizeSpeech } from "../src/lib/elevenlabs/server";
import { transcribeSpeech } from "../src/lib/elevenlabs/speech-to-text";

type ExpectedLang = "en" | "pa";

function normalizeDetected(code: string | null): ExpectedLang | "other" | null {
  if (!code) return null;
  const c = code.toLowerCase();
  if (c === "en" || c === "eng" || c.startsWith("en-")) return "en";
  if (c === "pa" || c === "pan" || c === "pun" || c.startsWith("pa-")) return "pa";
  return "other";
}

function expectedDirection(lang: ExpectedLang): "en-to-pa" | "pa-to-en" {
  return lang === "en" ? "en-to-pa" : "pa-to-en";
}

type AudioCase = {
  label: string;
  expected: ExpectedLang;
  ttsText: string;
};

const AUDIO_CASES: AudioCase[] = [
  {
    label: "English — conversational",
    expected: "en",
    ttsText: "Can we meet tomorrow after work? I will bring the kids.",
  },
  {
    label: "English — short",
    expected: "en",
    ttsText: "Yes, sure.",
  },
  {
    label: "Punjabi — greeting",
    expected: "pa",
    ttsText: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?",
  },
  {
    label: "Punjabi — daily life",
    expected: "pa",
    ttsText: "ਮੈਂ ਅੱਜ ਘਰ ਰਹਿੰਦਾ ਹਾਂ ਅਤੇ ਖਾਣਾ ਬਣਾਉਂਦਾ ਹਾਂ।",
  },
  {
    label: "Punjabi + English loanwords (Gurmukhi)",
    expected: "pa",
    ttsText: "ਮੈਂ office ਜਾ ਰਿਹਾ ਹਾਂ, meeting late ਹੈ।",
  },
  {
    label: "English with Punjabi place name",
    expected: "en",
    ttsText: "We are going to the gurdwara on Sunday morning.",
  },
];

type TextCase = {
  label: string;
  expected: "en-to-pa" | "pa-to-en";
  languageCode: string | null;
  transcript: string;
  activeSide: "member" | "other";
};

const TEXT_CASES: TextCase[] = [
  {
    label: "Clean English STT",
    expected: "en-to-pa",
    languageCode: "eng",
    transcript: "How are you today?",
    activeSide: "other",
  },
  {
    label: "Clean Punjabi STT",
    expected: "pa-to-en",
    languageCode: "pan",
    transcript: "ਮੈਂ ਠੀਕ ਹਾਂ।",
    activeSide: "member",
  },
  {
    label: "Wrong STT eng + Gurmukhi transcript → Punjabi direction",
    expected: "pa-to-en",
    languageCode: "eng",
    transcript: "ਮੈਂ office ਜਾ ਰਿਹਾ ਹਾਂ",
    activeSide: "other",
  },
  {
    label: "Wrong STT hin (untrusted) + Latin only → English direction",
    expected: "en-to-pa",
    languageCode: "hin",
    transcript: "Meeting late",
    activeSide: "other",
  },
  {
    label: "Null STT lang, Gurmukhi + loanwords",
    expected: "pa-to-en",
    languageCode: null,
    transcript: "ਮੈਂ school ਜਾ ਰਿਹਾ ਹਾਂ",
    activeSide: "member",
  },
  {
    label: "Null STT lang, Latin-only English",
    expected: "en-to-pa",
    languageCode: null,
    transcript: "see you later",
    activeSide: "other",
  },
  {
    label: "Ambiguous — no script, toggle fallback (other)",
    expected: "pa-to-en",
    languageCode: null,
    transcript: "???",
    activeSide: "other",
  },
  {
    label: "Ambiguous — no script, toggle fallback (member)",
    expected: "en-to-pa",
    languageCode: null,
    transcript: "123",
    activeSide: "member",
  },
];

async function runAudioCase(test: AudioCase) {
  const tts = await synthesizeSpeech({ text: test.ttsText });
  const blob = new Blob([tts.audio], { type: "audio/mpeg" });
  const stt = await transcribeSpeech(blob);
  const detected = normalizeDetected(stt.languageCode);
  const langOk = detected === test.expected;
  const { direction, source } = resolveTranslationDirectionWithSource({
    languageCode: stt.languageCode,
    activeSide: test.expected === "en" ? "member" : "other",
    transcript: stt.text,
  });
  const dirOk = direction === expectedDirection(test.expected);

  return {
    ...test,
    transcript: stt.text,
    language_code: stt.languageCode,
    language_probability: stt.languageProbability,
    detected,
    langOk,
    direction,
    direction_source: source,
    dirOk,
  };
}

function runTextCase(test: TextCase) {
  const { direction, source } = resolveTranslationDirectionWithSource({
    languageCode: test.languageCode,
    activeSide: test.activeSide,
    transcript: test.transcript,
  });
  return {
    ...test,
    direction,
    direction_source: source,
    ok: direction === test.expected,
  };
}

async function main() {
  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    console.error("ELEVENLABS_API_KEY required.");
    process.exit(1);
  }

  console.log("=== Text / direction scenarios (code-switch & fallback) ===\n");
  let textPass = 0;
  for (const test of TEXT_CASES) {
    const r = runTextCase(test);
    const icon = r.ok ? "✓" : "✗";
    if (r.ok) textPass += 1;
    console.log(
      `${icon} ${r.label}\n   expected ${r.expected}, got ${r.direction} (${r.direction_source})\n   lang=${r.languageCode ?? "null"} transcript=${r.transcript.slice(0, 60)}\n`
    );
  }
  console.log(`Text scenarios: ${textPass}/${TEXT_CASES.length} direction matches expected\n`);

  console.log("=== Audio STT auto-detect (TTS → Scribe, no language hint) ===\n");
  const audioResults: Array<Awaited<ReturnType<typeof runAudioCase>> | { label: string; error: true }> =
    [];
  for (const test of AUDIO_CASES) {
    try {
      const r = await runAudioCase(test);
      audioResults.push(r);
      const icon = r.langOk && r.dirOk ? "✓" : "✗";
      console.log(`${icon} ${r.label}`);
      console.log(`   expected lang: ${r.expected}, detected: ${r.detected} (${r.language_code})`);
      console.log(
        `   probability: ${r.language_probability ?? "n/a"} | direction: ${r.direction} (${r.direction_source})`
      );
      console.log(`   transcript: ${r.transcript.slice(0, 120)}\n`);
    } catch (e) {
      console.log(`✗ ${test.label}: ${e instanceof Error ? e.message : e}\n`);
      audioResults.push({ label: test.label, error: true });
    }
  }

  const scored = audioResults.filter(
    (r): r is Awaited<ReturnType<typeof runAudioCase>> => !("error" in r && r.error)
  );
  const langHits = scored.filter((r) => r.langOk).length;
  const dirHits = scored.filter((r) => r.dirOk).length;
  const probs = scored
    .map((r) => r.language_probability)
    .filter((p): p is number => p != null);
  const avgProb = probs.length ? probs.reduce((a, b) => a + b, 0) / probs.length : null;
  const lowConf = scored.filter(
    (r) => r.language_probability != null && r.language_probability < 0.5
  );

  console.log("=== Summary ===");
  console.log(
    `Language detection: ${langHits}/${scored.length} clips matched expected language`
  );
  console.log(
    `End-to-end direction: ${dirHits}/${scored.length} clips would translate the right way`
  );
  if (avgProb != null) {
    console.log(
      `language_probability: avg ${avgProb.toFixed(3)}, min ${Math.min(...probs).toFixed(3)}, max ${Math.max(...probs).toFixed(3)}`
    );
  } else {
    console.log("language_probability: not returned on any clip (field may be absent in API)");
  }
  if (lowConf.length) {
    console.log(`Low confidence (<0.5): ${lowConf.map((r) => r.label).join("; ")}`);
  }

  const wrongLang = scored.filter((r) => !r.langOk);
  if (wrongLang.length) {
    console.log("\nLanguage mismatches:");
    for (const r of wrongLang) {
      console.log(`  - ${r.label}: wanted ${r.expected}, got ${r.detected} — "${r.transcript}"`);
    }
  }

  const wrongDir = scored.filter((r) => !r.dirOk);
  if (wrongDir.length) {
    console.log("\nDirection mismatches:");
    for (const r of wrongDir) {
      console.log(
        `  - ${r.label}: ${r.direction} via ${r.direction_source} (lang ${r.language_code})`
      );
    }
  }

  console.log(
    "\nNote: TTS round-trips are synthetic; validate on a real device with conversational speech."
  );
}

void main();
