/**
 * Upload official DfT UK traffic sign JPGs for Driving Theory quiz questions
 * and set quiz_questions.image_url + image_attribution.
 *
 * Source: https://www.gov.uk/guidance/traffic-sign-images (Open Government Licence).
 *
 * Prerequisites:
 *   1. Download + unzip JPG packs from that page into EXTRACTION_DIR (default /tmp/uk-traffic-signs/extracted)
 *   2. .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/upload-driving-theory-sign-images.ts --dry-run
 *   npx tsx scripts/upload-driving-theory-sign-images.ts
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const QUIZ_ID = "cf2161d6-9211-44cb-8748-acf3fa0d6ef5";
const BUCKET = "quiz-question-images";
const ATTRIBUTION =
  "Traffic sign image: Crown copyright, Department for Transport, Open Government Licence v3.0";

/** Temporary lookup codes → official DfT JPG filenames from the GOV.UK packs. */
const CODE_TO_FILENAME: Record<string, string> = {
  GIVE_WAY_TRIANGLE: "602.jpg",
  STOP_SIGN: "601.1.jpg",
  NO_ENTRY: "616.jpg",
  NO_OVERTAKING: "632.jpg",
  SPEED_LIMIT_CIRCLE: "670V30.jpg",
  MANDATORY_DIRECTION_ARROW: "609.jpg",
  GENERIC_TRIANGLE_WARNING: "562.jpg",
  HUMP_BRIDGE: "528.jpg",
  MOTORWAY_RED_X: "5003.jpg",
  ZEBRA_CROSSING: "544.jpg",
  BEND_LEFT: "512L.jpg",
  DOUBLE_BEND: "513.jpg",
  CROSSROADS: "504.1.jpg",
  ROUNDABOUT_AHEAD: "510.jpg",
  TRAFFIC_SIGNALS_AHEAD: "543.jpg",
  ROAD_NARROWS_BOTH_SIDES: "516.jpg",
  DUAL_CARRIAGEWAY_ENDS: "520.jpg",
  LOW_BRIDGE: "530A.JPG",
  QUAYSIDE: "555.jpg",
  SLIPPERY_ROAD: "557.jpg",
  ICE: "554.2.jpg",
  HORSE_RIDER: "550.1.jpg",
  CATTLE: "548.jpg",
  PEDESTRIANS_SCHOOL: "545.jpg",
  SCHOOL_CROSSING_PATROL: "547.1.jpg",
  CYCLISTS_WARNING: "950.jpg",
  BLIND_PEDESTRIANS: "547.4B.jpg",
  LEVEL_CROSSING_BARRIER: "770.jpg",
  LEVEL_CROSSING_NO_BARRIER: "771.jpg",
  FALLING_ROCKS: "559.jpg",
  OPENING_BRIDGE: "529.jpg",
  TUNNEL_AHEAD: "529.1.jpg",
  TRAFFIC_QUEUES_LIKELY: "584.jpg",
  UNEVEN_ROAD: "556.jpg",
  GUSTY_WINDS: "581.jpg",
  STEEP_HILL_DOWN: "523.1.jpg",
  NO_U_TURNS: "614.jpg",
  NO_LEFT_TURN: "613.jpg",
  NO_MOTOR_VEHICLES: "619.jpg",
  NO_CYCLING: "951.jpg",
  NO_PEDESTRIANS: "625.1.jpg",
  MAX_HEIGHT: "629.2A.jpg",
  MAX_WEIGHT: "622.1A.jpg",
  NATIONAL_SPEED_LIMIT_DERESTRICTION: "671.jpg",
  NO_STOPPING_CLEARWAY: "642.jpg",
  NO_WAITING: "637.3V.jpg",
  AHEAD_ONLY: "606.jpg",
  MINI_ROUNDABOUT: "611.1.jpg",
  ONE_WAY_TRAFFIC: "652.jpg",
  MINIMUM_SPEED: "672.jpg",
  SEGREGATED_CYCLE_PATH: "957.jpg",
  END_OF_MOTORWAY: "2931.jpg",
  HOSPITAL_SIGN: "827.2.jpg",
  PARKING_SIGN: "801.jpg",
  NO_THROUGH_ROAD: "816.jpg",
  TWO_WAY_TRAFFIC_AHEAD: "521.jpg",
};

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit?.slice(prefix.length);
}

function walkFiles(dir: string, out: Map<string, string>) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkFiles(full, out);
      continue;
    }
    if (!/\.jpe?g$/i.test(entry)) continue;
    const key = entry.toLowerCase();
    // Prefer on-street parking 801 over information-signs 801 when both exist.
    if (out.has(key) && !full.includes("on-street-parking")) continue;
    out.set(key, full);
  }
}

function publicObjectUrl(supabaseUrl: string, bucket: string, path: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

async function main() {
  loadEnvLocal();
  const dryRun = hasFlag("dry-run");
  const extractionDir = resolve(
    argValue("dir") ?? "/tmp/uk-traffic-signs/extracted"
  );

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");

  const fileIndex = new Map<string, string>();
  walkFiles(extractionDir, fileIndex);
  if (fileIndex.size === 0) {
    throw new Error(
      `No JPG files under ${extractionDir}. Download GOV.UK traffic-sign JPG zips first.`
    );
  }

  const supabase = createClient(url, key);
  if (!dryRun) {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) throw new Error(error.message);
    if (!(buckets ?? []).some((b) => b.id === BUCKET || b.name === BUCKET)) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
      });
      if (createError) throw new Error(createError.message);
      console.log(`Created bucket ${BUCKET}`);
    }
  }

  const { data: rows, error: qError } = await supabase
    .from("quiz_questions")
    .select("id, question_order, image_attribution, image_url")
    .eq("quiz_id", QUIZ_ID)
    .not("image_attribution", "is", null)
    .order("question_order", { ascending: true });
  if (qError) throw new Error(qError.message);

  console.log(`Questions with attribution: ${rows?.length ?? 0}`);
  console.log(`Extraction dir: ${extractionDir} (${fileIndex.size} jpgs)`);

  let uploaded = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const code = String(row.image_attribution ?? "").trim();
    // Skip rows already converted to the licence attribution string.
    if (code.startsWith("Traffic sign image:")) {
      if (row.image_url) {
        skipped += 1;
        continue;
      }
    }

    const filename = CODE_TO_FILENAME[code];
    if (!filename) {
      console.error(`No filename mapping for code ${code} (${row.id})`);
      failed += 1;
      continue;
    }

    const localPath = fileIndex.get(filename.toLowerCase());
    if (!localPath) {
      console.error(`Missing local file ${filename} for ${code}`);
      failed += 1;
      continue;
    }

    const storagePath = `driving-theory/${code.toLowerCase()}${filename
      .slice(filename.lastIndexOf("."))
      .toLowerCase()}`;
    const publicUrl = publicObjectUrl(url, BUCKET, storagePath);

    console.log(
      `${dryRun ? "[dry-run] " : ""}${row.question_order} ${code} ← ${filename}`
    );

    if (dryRun) {
      uploaded += 1;
      updated += 1;
      continue;
    }

    try {
      const bytes = readFileSync(localPath);
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, bytes, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (uploadError) throw new Error(uploadError.message);

      const { error: updateError } = await supabase
        .from("quiz_questions")
        .update({
          image_url: publicUrl,
          image_attribution: ATTRIBUTION,
        })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);

      uploaded += 1;
      updated += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `FAILED ${code}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(
    `\nDone. uploaded=${uploaded} updated=${updated} skipped=${skipped} failed=${failed}`
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
