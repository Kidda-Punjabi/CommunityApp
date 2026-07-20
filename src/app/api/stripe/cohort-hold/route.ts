import "server-only";

import { cohortHoldExpiresAt, getCohortCheckoutRemainingSpots } from "@/lib/group-purchase/cohort-capacity";
import { isCohortNotionSyncFresh } from "@/lib/group-purchase/cohort-picker-display";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let cohortId: string;

  try {
    const body = (await request.json()) as { cohortId?: string };
    cohortId = body.cohortId?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!cohortId) {
    return NextResponse.json({ error: "cohortId is required." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to reserve a cohort seat." }, { status: 401 });
  }

  const { data: cohort, error: cohortError } = await supabase
    .from("cohorts")
    .select("id, capacity, status, course_id, notion_synced_at")
    .eq("id", cohortId)
    .maybeSingle();

  if (cohortError) {
    return NextResponse.json({ error: cohortError.message }, { status: 500 });
  }

  if (!cohort || cohort.status !== "recruiting") {
    return NextResponse.json({ error: "This cohort is not open for enrollment." }, { status: 400 });
  }

  if (!isCohortNotionSyncFresh(cohort.notion_synced_at)) {
    return NextResponse.json(
      { error: "Availability for this cohort is still updating. Refresh and try again." },
      { status: 409 }
    );
  }

  const capacity = cohort.capacity ?? 7;
  const remaining = await getCohortCheckoutRemainingSpots(supabase, cohortId, capacity);

  if (remaining <= 0) {
    return NextResponse.json({ error: "This cohort is full." }, { status: 409 });
  }

  const expiresAt = cohortHoldExpiresAt();

  const { data: hold, error: insertError } = await supabase
    .from("cohort_seat_holds")
    .insert({
      cohort_id: cohortId,
      user_id: user.id,
      expires_at: expiresAt,
    })
    .select("id, expires_at")
    .single();

  if (insertError) {
    const message = insertError.message.includes("cohort_seat_holds")
      ? `${insertError.message} Run supabase/cohort-seat-holds.sql in the Supabase SQL Editor, then retry.`
      : insertError.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ holdId: hold.id, expiresAt: hold.expires_at });
}
