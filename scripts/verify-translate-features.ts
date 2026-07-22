/**
 * Verify Live Translate + Photo Translate setup and core behavior.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/verify-translate-features.ts
 *
 * Optional (applies photo_translate_usage migration if missing):
 *   SUPABASE_ACCESS_TOKEN=... node --env-file=.env.local --import tsx scripts/verify-translate-features.ts --apply-migrations
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { resolveTranslationDirection } from "../src/lib/live-translate/direction";
import { parsePhotoTranslateModelJson } from "../src/lib/photo-translate/scan-image";
import {
  incrementLiveTranslateUsage,
  loadLiveTranslateUsage,
} from "../src/lib/live-translate/usage";
import {
  incrementPhotoTranslateUsage,
  loadPhotoTranslateUsage,
} from "../src/lib/photo-translate/usage";
import { PHOTO_TRANSLATE_MONTHLY_CAP_SCANS } from "../src/lib/photo-translate/config";
import { LIVE_TRANSLATE_MONTHLY_CAP_SECONDS } from "../src/lib/live-translate/config";
import { translateLiveUtterance } from "../src/lib/live-translate/translate";
import { scanPhotoForPunjabiText } from "../src/lib/photo-translate/scan-image";
import { synthesizeSpeech } from "../src/lib/elevenlabs/server";
import { transcribeSpeech } from "../src/lib/elevenlabs/speech-to-text";

const PROJECT_REF = "pztubczhqkzcwtkstpgi";
const applyMigrations = process.argv.includes("--apply-migrations");

type CheckResult = { name: string; ok: boolean; detail: string };

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${name}: ${detail}`);
}

async function applySql(filename: string) {
  const sql = readFileSync(resolve(process.cwd(), filename), "utf8");
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error("SUPABASE_ACCESS_TOKEN is required to apply migrations.");
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${filename} failed (${response.status}): ${body.slice(0, 500)}`);
  }
}

async function tableExists(
  admin: ReturnType<typeof createClient>,
  table: string
): Promise<boolean> {
  const { error } = await admin.from(table).select("id").limit(1);
  return !error;
}

function testJsonParsing() {
  const plain = parsePhotoTranslateModelJson(
    '{"text_detected":true,"full_translation":"Closed on Mondays","summary":"Shop hours sign."}'
  );
  record(
    "photo JSON parse (plain)",
    plain.text_detected && plain.full_translation === "Closed on Mondays",
    plain.text_detected ? "parsed" : "failed"
  );

  const fenced = parsePhotoTranslateModelJson(
    '```json\n{"text_detected":false,"full_translation":null,"summary":null}\n```'
  );
  record(
    "photo JSON parse (fenced)",
    !fenced.text_detected && fenced.full_translation === null,
    "fenced response handled"
  );

  const noText = parsePhotoTranslateModelJson(
    '{"text_detected":false,"full_translation":"should ignore","summary":"ignore"}'
  );
  record(
    "photo JSON no-text guard",
    !noText.text_detected && noText.full_translation === null,
    "nulls forced when text_detected false"
  );
}

function testDirectionResolution() {
  const en = resolveTranslationDirection({
    languageCode: "en",
    activeSide: "other",
    transcript: "hello",
  });
  record("direction from English STT", en === "en-to-pa", en);

  const pa = resolveTranslationDirection({
    languageCode: "pan",
    activeSide: "member",
    transcript: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ",
  });
  record("direction from Punjabi STT", pa === "pa-to-en", pa);

  const sideFallback = resolveTranslationDirection({
    languageCode: null,
    activeSide: "other",
    transcript: "???",
  });
  record("direction side fallback", sideFallback === "pa-to-en", sideFallback);

  const gurmukhiBeatsEng = resolveTranslationDirection({
    languageCode: "eng",
    activeSide: "member",
    transcript: "ਮੈਂ office ਜਾ ਰਿਹਾ ਹਾਂ",
  });
  record(
    "direction Gurmukhi beats eng language_code",
    gurmukhiBeatsEng === "pa-to-en",
    gurmukhiBeatsEng
  );
}

async function testUsageTables(admin: ReturnType<typeof createClient>, userId: string) {
  const liveBefore = await loadLiveTranslateUsage(admin, userId);
  const liveAfter = await incrementLiveTranslateUsage(admin, userId, 2);
  record(
    "live translate usage increment",
    liveAfter.secondsUsed === liveBefore.secondsUsed + 2 &&
      liveAfter.secondsRemaining === LIVE_TRANSLATE_MONTHLY_CAP_SECONDS - liveAfter.secondsUsed,
    `${liveAfter.secondsUsed}s used, ${liveAfter.secondsRemaining}s remaining`
  );

  const photoBefore = await loadPhotoTranslateUsage(admin, userId);
  const photoAfter = await incrementPhotoTranslateUsage(admin, userId);
  record(
    "photo translate usage increment",
    photoAfter.scansUsed === photoBefore.scansUsed + 1 &&
      photoAfter.scansRemaining === PHOTO_TRANSLATE_MONTHLY_CAP_SCANS - photoAfter.scansUsed,
    `${photoAfter.scansUsed} scans used, ${photoAfter.scansRemaining} remaining`
  );
}

async function testElevenLabsStt() {
  if (!process.env.ELEVENLABS_API_KEY?.trim()) {
    record("live translate ElevenLabs STT", false, "ELEVENLABS_API_KEY not set — skipped");
    return;
  }

  const tts = await synthesizeSpeech({ text: "Hello, how are you today?" });
  const blob = new Blob([tts.audio], { type: "audio/mpeg" });
  const sttHinted = await transcribeSpeech(blob, { languageCode: "en" });
  record(
    "live translate ElevenLabs STT (hinted en)",
    sttHinted.text.length > 0,
    `${sttHinted.text} (${sttHinted.languageCode ?? "no lang"}, p=${sttHinted.languageProbability ?? "n/a"})`
  );

  const sttAuto = await transcribeSpeech(blob);
  record(
    "live translate ElevenLabs STT (auto-detect)",
    sttAuto.text.length > 0,
    `${sttAuto.text} (${sttAuto.languageCode ?? "no lang"}, p=${sttAuto.languageProbability ?? "n/a"})`
  );
}

async function testAnthropicLiveTranslate() {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    record("live translate Claude", false, "ANTHROPIC_API_KEY not set — skipped");
    return;
  }

  const translated = await translateLiveUtterance("Hello, how are you?", "en-to-pa");
  record(
    "live translate Claude",
    translated.length > 0,
    translated.slice(0, 80)
  );
}

async function testAnthropicPhotoScan() {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    record("photo translate Claude vision", false, "ANTHROPIC_API_KEY not set — skipped");
    return;
  }

  // 1x1 white JPEG — should return text_detected: false, not hallucinate
  const tinyJpegBase64 =
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==";
  const bytes = Buffer.from(tinyJpegBase64, "base64");
  const result = await scanPhotoForPunjabiText(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "image/jpeg");
  record(
    "photo translate no-text image",
    result.text_detected === false && result.full_translation === null,
    result.text_detected ? "unexpected text detected" : "correctly returned no text"
  );
}

async function testHttpRoutes() {
  const candidates = ["http://localhost:3000", process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "")].filter(
    Boolean
  ) as string[];

  for (const path of ["/api/live-translate/process-turn", "/api/photo-translate/scan"]) {
    let checked = false;
    for (const baseUrl of candidates) {
      try {
        const response = await fetch(`${baseUrl}${path}`, { method: "GET" });
        if (response.status === 404) continue;
        record(
          `${path} unauthenticated (${baseUrl})`,
          response.status === 401,
          `status ${response.status}`
        );
        checked = true;
        break;
      } catch {
        // try next base URL
      }
    }
    if (!checked) {
      record(`${path} unauthenticated`, false, "route not reachable on localhost or NEXT_PUBLIC_APP_URL");
    }
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase env vars.");
  }

  const admin = createClient(url, serviceKey);

  if (applyMigrations) {
    if (!(await tableExists(admin, "photo_translate_usage"))) {
      await applySql("supabase/photo-translate-usage.sql");
      console.log("Applied supabase/photo-translate-usage.sql");
    }
  }

  const liveTable = await tableExists(admin, "live_translate_usage");
  const photoTable = await tableExists(admin, "photo_translate_usage");
  record("live_translate_usage table", liveTable, liveTable ? "present" : "missing");
  record("photo_translate_usage table", photoTable, photoTable ? "present" : "missing — run migration");

  record(
    "ANTHROPIC_API_KEY",
    Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
    process.env.ANTHROPIC_API_KEY?.trim() ? "set" : "missing — Live + Photo translate need this"
  );
  record(
    "ELEVENLABS_API_KEY",
    Boolean(process.env.ELEVENLABS_API_KEY?.trim()),
    process.env.ELEVENLABS_API_KEY?.trim() ? "set" : "missing"
  );

  testJsonParsing();
  testDirectionResolution();

  const { data: paid } = await admin.from("course_access").select("user_id").limit(1).maybeSingle();
  const userId = paid?.user_id;
  if (!userId) {
    record("usage integration", false, "no paid user with course_access found");
  } else if (liveTable && photoTable) {
    await testUsageTables(admin, userId);
  } else {
    record("usage integration", false, "skipped — missing usage table(s)");
  }

  await testElevenLabsStt();
  await testAnthropicLiveTranslate();
  await testAnthropicPhotoScan();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "http://localhost:3000";
  try {
    await testHttpRoutes();
  } catch (error) {
    record("HTTP route checks", false, error instanceof Error ? error.message : "fetch failed");
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
