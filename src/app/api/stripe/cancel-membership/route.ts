import "server-only";

import { rejectNativePurchase } from "@/lib/native/reject-native-purchase";
import {
  acceptSaveOffer,
  cancelAtPeriodEnd,
  findOwnedOpenSubscription,
  isCancelReason,
} from "@/lib/stripe/cancel-save";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * POST { subscriptionId, action: "stay" | "cancel", reason? }
 * stay: applies the one-off "next month free" offer.
 * cancel: cancels at the end of the paid period (access continues until then).
 */
export async function POST(request: Request) {
  const blocked = rejectNativePurchase(request);
  if (blocked) return blocked;

  if (!process.env.STRIPE_SECRET_KEY?.startsWith("sk_")) {
    return NextResponse.json({ error: "Billing isn't set up." }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    subscriptionId?: unknown;
    action?: unknown;
    reason?: unknown;
  } | null;
  const subscriptionId = typeof body?.subscriptionId === "string" ? body.subscriptionId : null;
  const action = body?.action === "stay" || body?.action === "cancel" ? body.action : null;
  const reason = isCancelReason(body?.reason) ? body.reason : null;
  if (!subscriptionId || !action) {
    return NextResponse.json({ error: "Missing subscription or action." }, { status: 400 });
  }

  try {
    const sub = await findOwnedOpenSubscription(user.id, user.email ?? null, subscriptionId);
    if (!sub) {
      return NextResponse.json({ error: "We couldn't find that membership." }, { status: 404 });
    }

    if (action === "stay") {
      if (sub.metadata?.save_offer_used === "true" || (sub.discounts ?? []).length > 0) {
        return NextResponse.json({ error: "This offer has already been used." }, { status: 409 });
      }
      await acceptSaveOffer(sub, reason);
    } else {
      await cancelAtPeriodEnd(sub, reason);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[cancel-membership]", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
