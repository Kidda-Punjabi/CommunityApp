import { NotificationsList } from "@/components/notifications/notifications-list";
import { loadNotifications } from "@/lib/notifications/load-notifications";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const notifications = await loadNotifications(supabase, user.id);

  return <NotificationsList notifications={notifications} />;
}
