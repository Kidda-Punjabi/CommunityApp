/**
 * Store the webhook secret in vault, then replace trigger functions.
 *
 *   INTERNAL_NOTIFY_WEBHOOK_SECRET=... SUPABASE_ACCESS_TOKEN=... node --import tsx scripts/apply-notify-request-email.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "pztubczhqkzcwtkstpgi";
const SECRET_NAME = "internal_notify_webhook_secret";

async function query(token: string, sql: string): Promise<unknown> {
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
    throw new Error(`SQL failed (${response.status}): ${body.slice(0, 800)}`);
  }
  return JSON.parse(body) as unknown;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is required.");

  const secret = process.env.INTERNAL_NOTIFY_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("INTERNAL_NOTIFY_WEBHOOK_SECRET is required.");

  const existing = (await query(
    token,
    `SELECT id FROM vault.secrets WHERE name = ${sqlString(SECRET_NAME)} LIMIT 1;`
  )) as Array<{ id: string }>;

  if (existing[0]?.id) {
    await query(
      token,
      `SELECT vault.update_secret(${sqlString(existing[0].id)}::uuid, ${sqlString(secret)}, ${sqlString(SECRET_NAME)}, 'Shared secret for POST /api/internal/notify-request');`
    );
    console.log("Updated vault secret", SECRET_NAME);
  } else {
    await query(
      token,
      `SELECT vault.create_secret(${sqlString(secret)}, ${sqlString(SECRET_NAME)}, 'Shared secret for POST /api/internal/notify-request');`
    );
    console.log("Created vault secret", SECRET_NAME);
  }

  const sql = readFileSync(resolve(process.cwd(), "supabase/notify-request-email.sql"), "utf8");
  await query(token, sql);
  console.log("Applied supabase/notify-request-email.sql");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
