"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import {
  loadAdminTutorCalendars,
  type AdminTutorCalendarsData,
} from "@/lib/admin/load-admin-tutor-calendars";
import { syncTutorGoogleCalendar } from "@/lib/calendar/sync-tutor-calendar";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const CALENDAR_SYNC_REMINDER_TITLE = "Please connect your Google Calendar";
const CALENDAR_SYNC_REMINDER_BODY =
  "Your Google Calendar isn't connected yet. Open Tutor → Calendar in the app and connect Google Calendar so students can see upcoming lessons and request reschedules.";

export async function fetchAdminTutorCalendars(): Promise<AdminTutorCalendarsData> {
  try {
    const supabase = await requireAdminFromActions();
    return loadAdminTutorCalendars(supabase);
  } catch (e) {
    return {
      tutors: [],
      sessions: [],
      schemaReady: true,
      error: e instanceof Error ? e.message : "Failed to load tutor calendars.",
    };
  }
}

export async function resyncAllTutorCalendarsForAdmin(): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const { data: connections, error } = await supabase
      .from("tutor_google_calendar_connections")
      .select("tutor_id");

    if (error) return { error: error.message };
    if (!connections?.length) {
      return { error: "No tutors have connected Google Calendar yet." };
    }

    let synced = 0;
    let totalEvents = 0;
    const failures: string[] = [];

    for (const connection of connections) {
      try {
        const result = await syncTutorGoogleCalendar(supabase, connection.tutor_id, {
          forceFullSync: true,
        });
        synced += 1;
        totalEvents += result.synced;
      } catch (e) {
        failures.push(e instanceof Error ? e.message : "Sync failed");
      }
    }

    revalidatePath("/admin/content/calendar");

    if (synced === 0) {
      return { error: failures[0] ?? "Failed to sync calendars." };
    }

    const failureNote =
      failures.length > 0 ? ` ${failures.length} tutor${failures.length === 1 ? "" : "s"} failed.` : "";

    return {
      success: `Synced ${synced} tutor calendar${synced === 1 ? "" : "s"} from Google (${totalEvents} events).${failureNote}`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to sync calendars." };
  }
}

export async function resyncTutorCalendarForAdmin(tutorId: string): Promise<ActionResult> {
  const id = tutorId.trim();
  if (!id) return { error: "Tutor id is required." };

  try {
    const supabase = await requireAdminFromActions();

    const { data: connection, error } = await supabase
      .from("tutor_google_calendar_connections")
      .select("tutor_id")
      .eq("tutor_id", id)
      .maybeSingle();

    if (error) return { error: error.message };
    if (!connection) {
      return { error: "This tutor hasn't connected Google Calendar yet." };
    }

    const result = await syncTutorGoogleCalendar(supabase, id, { forceFullSync: true });
    revalidatePath("/admin/content/calendar");

    return {
      success: `Calendar synced — ${result.synced} event${result.synced === 1 ? "" : "s"} updated.`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to sync calendar." };
  }
}

export async function notifyTutorsToSyncCalendar(tutorIds: string[]): Promise<ActionResult> {
  const uniqueIds = [...new Set(tutorIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { error: "No tutors selected." };
  }

  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user || !(await canAccessAdminPanel(user, authClient))) {
    return { error: "Unauthorized" };
  }

  const { error } = await authClient.rpc("admin_publish_announcement", {
    p_title: CALENDAR_SYNC_REMINDER_TITLE,
    p_body: CALENDAR_SYNC_REMINDER_BODY,
    p_recipient_user_ids: uniqueIds,
  });

  if (error) return { error: error.message };

  return {
    success: `Calendar sync reminder sent to ${uniqueIds.length} tutor${uniqueIds.length === 1 ? "" : "s"}.`,
  };
}
