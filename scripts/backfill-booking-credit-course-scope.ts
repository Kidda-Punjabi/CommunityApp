/**
 * Backfill course_id / tutor_id on tutor_one_to_one_booking_credits.
 *
 * Dry-run by default. Pass --apply to write confident matches only.
 * Ambiguous rows are listed and never written.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx scripts/backfill-booking-credit-course-scope.ts
 *   node --env-file=.env.local --import tsx scripts/backfill-booking-credit-course-scope.ts --apply
 */
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import {
  inferCourseScopeFromBookingTutor,
  resolveBookingCreditCourseScope,
} from "../src/lib/tutoring/booking-credit-course";

type CreditRow = {
  id: string;
  student_id: string;
  stripe_checkout_session_id: string;
  status: string;
  booking_id: string | null;
  course_id: string | null;
  tutor_id: string | null;
};

type Decision =
  | { kind: "skip_already_scoped" }
  | { kind: "apply"; courseId: string; tutorId: string | null; reason: string }
  | { kind: "flag"; reason: string };

async function decide(
  sb: ReturnType<typeof createClient>,
  stripe: Stripe,
  credit: CreditRow
): Promise<Decision> {
  if (credit.course_id) {
    return { kind: "skip_already_scoped" };
  }

  // 1) Linked calendar session course (confirmed bookings).
  if (credit.booking_id) {
    const { data: booking } = await sb
      .from("tutor_one_to_one_bookings")
      .select("id, tutor_id, session_id, tutor_scheduled_sessions(course_id)")
      .eq("id", credit.booking_id)
      .maybeSingle();

    const sessionRel = booking?.tutor_scheduled_sessions as
      | { course_id?: string | null }
      | Array<{ course_id?: string | null }>
      | null;
    const sessionCourse = Array.isArray(sessionRel)
      ? sessionRel[0]?.course_id
      : sessionRel?.course_id;

    if (sessionCourse) {
      const tutorId =
        (booking?.tutor_id as string | null) ??
        (await sb
          .from("course_enrollments")
          .select("tutor_id")
          .eq("user_id", credit.student_id)
          .eq("course_id", sessionCourse)
          .maybeSingle()
          .then((r) => (r.data?.tutor_id as string | null) ?? null));

      return {
        kind: "apply",
        courseId: sessionCourse,
        tutorId,
        reason: "linked tutor_scheduled_sessions.course_id",
      };
    }

    if (booking?.tutor_id) {
      const inferred = await inferCourseScopeFromBookingTutor(
        sb,
        credit.student_id,
        booking.tutor_id as string
      );
      if (inferred) {
        return {
          kind: "apply",
          courseId: inferred.courseId,
          tutorId: inferred.tutorId,
          reason: "unique non-group enrollment for booking tutor",
        };
      }
    }
  }

  // 2) Stripe checkout metadata (hosted Checkout Sessions).
  try {
    const session = await stripe.checkout.sessions.retrieve(credit.stripe_checkout_session_id);
    const fromMeta = await resolveBookingCreditCourseScope(sb, {
      studentId: credit.student_id,
      courseIdFromMeta: session.metadata?.course_id ?? null,
      tutorIdFromMeta: session.metadata?.tutor_id ?? null,
      checkoutKey: session.metadata?.checkout_key ?? null,
    });
    if (fromMeta) {
      return {
        kind: "apply",
        courseId: fromMeta.courseId,
        tutorId: fromMeta.tutorId,
        reason: "Stripe checkout metadata / checkout_key",
      };
    }
  } catch (error) {
    return {
      kind: "flag",
      reason: `Stripe retrieve failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // 3) Exactly one 1-1-style enrollment for the student.
  const { data: enrollments } = await sb
    .from("course_enrollments")
    .select("course_id, tutor_id, delivery_mode")
    .eq("user_id", credit.student_id)
    .not("tutor_id", "is", null);

  const oneToOne = (enrollments ?? []).filter((row) => row.delivery_mode === "one_to_one");
  if (oneToOne.length === 1 && oneToOne[0]?.course_id) {
    return {
      kind: "apply",
      courseId: oneToOne[0].course_id as string,
      tutorId: (oneToOne[0].tutor_id as string | null) ?? null,
      reason: "exactly one delivery_mode=one_to_one enrollment",
    };
  }

  const nonGroup = (enrollments ?? []).filter((row) => row.delivery_mode !== "group");
  if (nonGroup.length === 1 && nonGroup[0]?.course_id) {
    return {
      kind: "apply",
      courseId: nonGroup[0].course_id as string,
      tutorId: (nonGroup[0].tutor_id as string | null) ?? null,
      reason: "exactly one non-group enrollment",
    };
  }

  return {
    kind: "flag",
    reason:
      oneToOne.length > 1 || nonGroup.length > 1
        ? `ambiguous enrollments (one_to_one=${oneToOne.length}, non_group=${nonGroup.length})`
        : "no confident course signal (empty Stripe metadata + no unique enrollment)",
  };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!url || !key || !stripeKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY required");
  }

  const sb = createClient(url, key);
  const stripe = new Stripe(stripeKey);

  const { data: credits, error } = await sb
    .from("tutor_one_to_one_booking_credits")
    .select("id, student_id, stripe_checkout_session_id, status, booking_id, course_id, tutor_id")
    .order("purchased_at", { ascending: true });

  if (error) {
    throw new Error(
      `Load credits failed: ${error.message}. Apply supabase/booking-credits-course-scope.sql first.`
    );
  }

  const toApply: Array<{ id: string; courseId: string; tutorId: string | null; reason: string }> =
    [];
  const flagged: Array<{ id: string; studentId: string; reason: string }> = [];
  let skipped = 0;

  for (const credit of (credits ?? []) as CreditRow[]) {
    const decision = await decide(sb, stripe, credit);
    if (decision.kind === "skip_already_scoped") {
      skipped += 1;
      continue;
    }
    if (decision.kind === "flag") {
      flagged.push({ id: credit.id, studentId: credit.student_id, reason: decision.reason });
      continue;
    }
    toApply.push({
      id: credit.id,
      courseId: decision.courseId,
      tutorId: decision.tutorId,
      reason: decision.reason,
    });
  }

  console.log(`Credits scanned: ${credits?.length ?? 0}`);
  console.log(`Already scoped: ${skipped}`);
  console.log(`Confident to apply: ${toApply.length}`);
  console.log(`Flagged (ask before fixing): ${flagged.length}`);
  console.log("");

  for (const row of toApply) {
    console.log(`[apply] ${row.id} → course=${row.courseId} tutor=${row.tutorId ?? "null"} (${row.reason})`);
  }
  for (const row of flagged) {
    console.log(`[flag] ${row.id} student=${row.studentId} — ${row.reason}`);
  }

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write confident rows.");
    return;
  }

  for (const row of toApply) {
    const { error: updateError } = await sb
      .from("tutor_one_to_one_booking_credits")
      .update({ course_id: row.courseId, tutor_id: row.tutorId })
      .eq("id", row.id)
      .is("course_id", null);
    if (updateError) {
      throw new Error(`Update ${row.id} failed: ${updateError.message}`);
    }
  }

  console.log(`\nApplied ${toApply.length} credit(s). Flagged ${flagged.length} left untouched.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
