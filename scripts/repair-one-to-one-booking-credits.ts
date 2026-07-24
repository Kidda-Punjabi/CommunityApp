/**
 * Repair 1-to-1 booking credits after cancel-sync gap + missed payment-link webhook.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/repair-one-to-one-booking-credits.ts
 *   node --env-file=.env.local --import tsx scripts/repair-one-to-one-booking-credits.ts --apply
 *   node --env-file=.env.local --import tsx scripts/repair-one-to-one-booking-credits.ts --apply --session=cs_live_...
 */
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";

// Allow importing Next.js "server-only" modules from this CLI script.
const require = createRequire(import.meta.url);
require("module").Module._cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
};

const apply = process.argv.includes("--apply");
const sessionArg = process.argv.find((arg) => arg.startsWith("--session="));
const sessionId =
  sessionArg?.slice("--session=".length) ||
  "cs_live_b1kIrGJK9mYRFuDyuOvSeXva5nL7m1sC9rk8xcscYdYUwFs7obZpJxHFGp";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function main() {
  const admin = adminClient();
  console.log(apply ? "APPLY mode" : "DRY RUN (pass --apply to write)");

  const { data: usedCredits, error: creditsError } = await admin
    .from("tutor_one_to_one_booking_credits")
    .select("id, booking_id, status, student_id")
    .eq("status", "used")
    .not("booking_id", "is", null);
  if (creditsError) throw creditsError;

  const toRestore: Array<{ creditId: string; bookingId: string; sessionId: string | null }> = [];
  for (const credit of usedCredits ?? []) {
    const { data: booking } = await admin
      .from("tutor_one_to_one_bookings")
      .select("id, status, session_id")
      .eq("id", credit.booking_id as string)
      .maybeSingle();
    if (booking?.status === "cancelled") {
      toRestore.push({
        creditId: credit.id as string,
        bookingId: booking.id as string,
        sessionId: (booking.session_id as string | null) ?? null,
      });
    }
  }

  console.log(`Credits used on cancelled bookings: ${toRestore.length}`);
  for (const row of toRestore) {
    console.log(`  credit=${row.creditId} booking=${row.bookingId} session=${row.sessionId}`);
  }

  if (apply) {
    for (const row of toRestore) {
      const { error } = await admin
        .from("tutor_one_to_one_booking_credits")
        .update({ status: "available", booking_id: null, used_at: null })
        .eq("id", row.creditId)
        .eq("status", "used");
      if (error) throw error;

      if (row.sessionId) {
        const { error: sessionError } = await admin
          .from("tutor_scheduled_sessions")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", row.sessionId)
          .eq("status", "scheduled");
        if (sessionError) console.error("session cancel failed", sessionError.message);
      }
      console.log(`  restored ${row.creditId}`);
    }
  }

  console.log(`\nRe-syncing checkout session ${sessionId}…`);
  if (apply) {
    const { syncBookingCreditFromCheckoutSession } = await import(
      "../src/lib/stripe/sync-booking-credit"
    );
    const sync = await syncBookingCreditFromCheckoutSession(sessionId);
    console.log(sync);
  } else {
    console.log("(dry run — would call syncBookingCreditFromCheckoutSession)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
