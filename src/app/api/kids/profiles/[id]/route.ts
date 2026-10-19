import { NextResponse } from "next/server";
import { isKidAgeTier, isKidAvatarIcon } from "@/lib/kids/constants";
import { collectKidStorageFiles, removeStorageRefs } from "@/lib/storage/linked-user-files";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";
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

  const { data: owned, error: ownedError } = await supabase
    .from("kid_profiles")
    .select("id")
    .eq("id", id)
    .eq("parent_user_id", user.id)
    .maybeSingle();

  if (ownedError) {
    return NextResponse.json({ error: ownedError.message }, { status: 500 });
  }
  if (!owned) {
    return NextResponse.json({ ok: true });
  }

  const adminResult = tryCreateServiceRoleClient();
  let files: Awaited<ReturnType<typeof collectKidStorageFiles>> = [];
  if (!adminResult.client) {
    console.error("[kid-profile-delete] storage cleanup unavailable", adminResult.error);
  } else {
    try {
      files = await collectKidStorageFiles(adminResult.client, id);
    } catch (error) {
      console.error(
        "[kid-profile-delete] could not list files",
        error instanceof Error ? error.message : "unknown"
      );
    }
  }

  const { data: deleted, error } = await supabase
    .from("kid_profiles")
    .delete()
    .eq("id", id)
    .eq("parent_user_id", user.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deleted?.length || !adminResult.client) {
    return NextResponse.json({ ok: true });
  }

  try {
    const removed = await removeStorageRefs(adminResult.client, files);
    if (removed.errors.length > 0) {
      console.error("[kid-profile-delete] storage remove failed", {
        kidProfileId: id,
        errors: removed.errors.length,
      });
    }
  } catch (removeError) {
    console.error(
      "[kid-profile-delete] storage remove failed",
      removeError instanceof Error ? removeError.message : "unknown"
    );
  }

  return NextResponse.json({ ok: true });
}
