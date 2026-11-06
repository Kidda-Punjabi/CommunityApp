import { NextResponse } from "next/server";
import { loadKidSession } from "@/lib/kids/session";
import { maybeSendLevelCheckReady } from "@/lib/push/level-check-ready";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceRoleClient } from "@/lib/supabase/admin-server";

/** Client-safe entry for P2 after XP is awarded in the browser. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { client } = tryCreateServiceRoleClient();
  if (!client) return NextResponse.json({ ok: false });

  const kid = await loadKidSession(user.id);
  const result = await maybeSendLevelCheckReady(client, user.id, {
    kidProfileId: kid.activeKidProfile?.id ?? null,
  });
  return NextResponse.json({ ok: true, result });
}
