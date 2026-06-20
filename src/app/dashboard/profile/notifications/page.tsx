import { NotificationSettingsForm } from "@/components/notifications/notification-settings-form";
import { loadNotificationSettings } from "@/lib/notifications/load-notifications";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function NotificationSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const settings = await loadNotificationSettings(supabase);

  if (!settings) {
    return (
      <div className="flex flex-1 flex-col px-5 py-7">
        <Link href="/dashboard/profile" className="text-sm font-medium text-violet-600">
          ← Profile
        </Link>
        <p className="mt-4 text-sm text-zinc-600">
          Run supabase/friends-notifications.sql in Supabase to enable notifications.
        </p>
      </div>
    );
  }

  return <NotificationSettingsForm settings={settings} />;
}
