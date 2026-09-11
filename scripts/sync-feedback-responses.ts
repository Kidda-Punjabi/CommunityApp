/**
 * Full pull of Notion Feedback Database into feedback_responses.
 *
 *   node --env-file=.env.local --import tsx scripts/sync-feedback-responses.ts
 */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
require("module").Module._cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { pullFeedbackResponsesFromNotion } = await import(
    "../src/lib/notion/feedback-response-sync"
  );
  const result = await pullFeedbackResponsesFromNotion(supabase, { fullSync: true });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
