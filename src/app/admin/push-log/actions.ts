"use server";

import { requireAdminFromActions } from "@/app/admin/content/actions";
import { sendPush } from "@/lib/push/send";
import { createClient } from "@/lib/supabase/server";

export async function countActivePushDevices(): Promise<number> {
  const admin = await requireAdminFromActions();
  const { count } = await admin
    .from("device_push_tokens")
    .select("id", { count: "exact", head: true })
    .is("disabled_at", null);
  return count ?? 0;
}

export async function sendTestPushToMe(): Promise<void> {
  const admin = await requireAdminFromActions();
  void admin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await sendPush({
    userId: user.id,
    type: "test",
    refKey: `test-${Date.now()}`,
    title: "Kidda test",
    body: "Push notifications are working.",
    url: "/admin/push-log",
  });
}
