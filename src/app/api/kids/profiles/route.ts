import { NextResponse } from "next/server";
import { isKidAgeTier, isKidAvatarIcon } from "@/lib/kids/constants";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("kid_profiles")
    .select("*")
    .eq("parent_user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("kids_pin_hash")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    profiles: data ?? [],
    hasPin: Boolean(profile?.kids_pin_hash),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    avatarIcon?: string;
    ageTier?: string;
    guardianConfirmed?: boolean;
    termsAccepted?: boolean;
  };

  if (!body.name?.trim() || !isKidAvatarIcon(body.avatarIcon ?? "") || !isKidAgeTier(body.ageTier ?? "")) {
    return NextResponse.json({ error: "Invalid kid profile data." }, { status: 400 });
  }

  if (!body.guardianConfirmed || !body.termsAccepted) {
    return NextResponse.json(
      { error: "Confirm you are the parent or legal guardian and accept the Privacy Policy." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("kid_profiles")
    .insert({
      parent_user_id: user.id,
      name: body.name.trim(),
      avatar_icon: body.avatarIcon,
      age_tier: body.ageTier,
      guardian_confirmed_at: new Date().toISOString(),
      terms_accepted_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    const cap =
      error.message.includes("6 kid profiles") ||
      error.message.toLowerCase().includes("maximum allowed");
    return NextResponse.json(
      {
        error: cap
          ? "You've reached the limit of 6 kid profiles on this account."
          : error.message,
      },
      { status: cap ? 409 : 500 }
    );
  }

  return NextResponse.json({ profile: data });
}
