import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = (await request.json()) as {
    soundEnabled?: boolean;
    soundVolume?: number;
  };

  const updates: Record<string, boolean | number> = {};

  if (typeof body.soundEnabled === "boolean") {
    updates.sound_enabled = body.soundEnabled;
  }

  if (typeof body.soundVolume === "number" && !Number.isNaN(body.soundVolume)) {
    updates.sound_volume = Math.min(1, Math.max(0, body.soundVolume));
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid sound settings provided." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", user.id)
    .select("sound_enabled, sound_volume")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    soundEnabled: data.sound_enabled ?? true,
    soundVolume: data.sound_volume ?? 0.7,
  });
}
