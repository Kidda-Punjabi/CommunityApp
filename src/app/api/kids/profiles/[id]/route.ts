import { NextResponse } from "next/server";
import { isKidAgeTier, isKidAvatarIcon } from "@/lib/kids/constants";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    name?: string;
    avatarIcon?: string;
    ageTier?: string;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const updates: Record<string, string> = {};
  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.avatarIcon && isKidAvatarIcon(body.avatarIcon)) updates.avatar_icon = body.avatarIcon;
  if (body.ageTier && isKidAgeTier(body.ageTier)) updates.age_tier = body.ageTier;

  const { data, error } = await supabase
    .from("kid_profiles")
    .update(updates)
    .eq("id", id)
    .eq("parent_user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { error } = await supabase
    .from("kid_profiles")
    .delete()
    .eq("id", id)
    .eq("parent_user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
