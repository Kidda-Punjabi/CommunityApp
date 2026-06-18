/**
 * Sync Stripe purchases → app course access by matching email.
 *
 * Usage:
 *   npm run sync-stripe -- --dry-run --limit 5
 *   npm run sync-stripe -- --limit 10
 *   npm run sync-stripe -- --email someone@example.com
 *   npm run sync-stripe
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { bulkSyncStripeCustomers } from "../src/lib/stripe/bulk-sync";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function readArg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const limitRaw = readArg("--limit");
  const email = readArg("--email");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    console.error(
      "STRIPE_SECRET_KEY is missing or still a placeholder in .env.local"
    );
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY is missing in .env.local");
    process.exit(1);
  }

  console.log(
    dryRun
      ? "Dry run — no database writes"
      : "Writing course access to Supabase"
  );
  if (limit) console.log(`Batch limit: ${limit} purchaser(s)`);
  if (email) console.log(`Filter email: ${email}`);
  console.log("");

  const results = await bulkSyncStripeCustomers({
    dryRun,
    limit,
    email,
  });

  if (!results.length) {
    console.log("No matching Stripe purchases found.");
    return;
  }

  const synced = results.filter((r) => r.status === "synced" || r.status === "dry_run");
  const noUser = results.filter((r) => r.status === "no_app_user");
  const noPurchases = results.filter((r) => r.status === "no_purchases");

  for (const row of results) {
    const tiers = row.tiers.length ? row.tiers.join(", ") : "—";
    const user = row.userId ? row.userId.slice(0, 8) + "…" : "no app account";
    console.log(`${row.email}`);
    console.log(`  status: ${row.status}`);
    console.log(`  courses: ${tiers}`);
    console.log(`  app user: ${user}`);
    console.log("");
  }

  console.log("—".repeat(40));
  console.log(`Matched purchasers: ${results.length}`);
  console.log(`Would sync / synced: ${synced.length}`);
  console.log(`Purchased but no app login: ${noUser.length}`);
  if (noPurchases.length) console.log(`No mapped products: ${noPurchases.length}`);

  if (noUser.length) {
    console.log("");
    console.log("These emails bought on Stripe but have not signed up in the app yet:");
    for (const row of noUser) {
      console.log(`  - ${row.email} (${row.tiers.join(", ")})`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
