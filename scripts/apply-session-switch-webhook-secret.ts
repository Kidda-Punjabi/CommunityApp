/**
 * Store the session-switch webhook secret in vault.
 *
 *   INTERNAL_SESSION_SWITCH_WEBHOOK_SECRET=... SUPABASE_ACCESS_TOKEN=... node --import tsx scripts/apply-session-switch-webhook-secret.ts
 */
const PROJECT_REF = "pztubczhqkzcwtkstpgi";
const SECRET_NAME = "internal_session_switch_webhook_secret";

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

  const secret = process.env.INTERNAL_SESSION_SWITCH_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("INTERNAL_SESSION_SWITCH_WEBHOOK_SECRET is required.");

  const existing = (await query(
    token,
    `SELECT id FROM vault.secrets WHERE name = ${sqlString(SECRET_NAME)} LIMIT 1;`
  )) as Array<{ id: string }>;

  if (existing[0]?.id) {
    await query(
      token,
      `SELECT vault.update_secret(${sqlString(existing[0].id)}::uuid, ${sqlString(secret)}, ${sqlString(SECRET_NAME)}, 'Shared secret for POST /api/internal/session-switch-approved');`
    );
    console.log("Updated vault secret", SECRET_NAME);
  } else {
    await query(
      token,
      `SELECT vault.create_secret(${sqlString(secret)}, ${sqlString(SECRET_NAME)}, 'Shared secret for POST /api/internal/session-switch-approved');`
    );
    console.log("Created vault secret", SECRET_NAME);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
