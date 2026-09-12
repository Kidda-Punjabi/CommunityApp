import { NotificationsList } from "@/components/notifications/notifications-list";
import { resolveCourseActor } from "@/lib/kids/course-actor";
import { loadNotifications } from "@/lib/notifications/load-notifications";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const actor = await resolveCourseActor(supabase, user.id);
  const notifications = await loadNotifications(supabase, user.id, {
    kidProfileId: actor.kind === "kid" ? actor.kidProfileId : null,
  });

  return <NotificationsList notifications={notifications} />;
}
