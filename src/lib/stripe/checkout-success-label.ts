import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { getStripe } from "@/lib/stripe/server";

/** Human-readable purchase line for checkout success (uses session + student_packages, not only course_access). */
export async function formatCheckoutSuccessAccessLabel(
  userId: string,
  sessionId: string
): Promise<string | null> {
  const admin = createServiceRoleClient();

  const { data: studentPackage } = await admin
    .from("student_packages")
    .select("status, packages(name, slug)")
    .eq("user_id", userId)
    .eq("last_stripe_checkout_session_id", sessionId)
    .maybeSingle();

  const pkg = Array.isArray(studentPackage?.packages)
    ? studentPackage.packages[0]
    : studentPackage?.packages;

  if (pkg?.name) {
    if (studentPackage?.status === "confirmed") {
      return `${pkg.name} — enrolled`;
    }
    return `${pkg.name} — payment received (finishing setup…)`;
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const key = session.metadata?.checkout_key;
    if (key === "beginners-group") return "Beginners Course (Group)";
    if (key === "beginners-one-to-one") return "Beginners Course (1-to-1)";
    if (key?.startsWith("foundational")) return "Foundational Course";
    if (key === "community") return "Kidda Community";
  } catch {
    // Stripe unavailable — fall back to generic copy on the page.
  }

  return null;
}
