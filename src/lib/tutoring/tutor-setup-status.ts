import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTutorCalendarStatus } from "@/lib/calendar/load-sessions";
import { isAvailabilitySchemaMissingError } from "@/lib/tutoring/availability/schema";

export type TutorSetupItemId = "bio" | "photo" | "calendar" | "availability";

export type TutorSetupItem = {
  id: TutorSetupItemId;
  title: string;
  description: string;
  href: string;
  complete: boolean;
};

export type TutorSetupStatus = {
  /** Show checklist card, banner, and profile setup link */
  showPrompt: boolean;
  items: TutorSetupItem[];
  completedCount: number;
  totalCount: number;
};

const MIN_BIO_LENGTH = 20;

const SETUP_ITEMS: Omit<TutorSetupItem, "complete">[] = [
  {
    id: "bio",
    title: "Write a short bio",
    description:
      "A couple of sentences about yourself and your interests outside of teaching — students are meeting a real person.",
    href: "/dashboard/tutor/profile/edit#bio",
  },
  {
    id: "photo",
    title: "Upload a profile photo",
    description: "Replace the default avatar so students can recognise you.",
    href: "/dashboard/tutor/profile/edit#photo",
  },
  {
    id: "calendar",
    title: "Connect Google Calendar",
    description: "Sync your lesson schedule from Google Calendar.",
    href: "/dashboard/tutor/calendar#google-calendar",
  },
  {
    id: "availability",
    title: "Set availability",
    description: "Weekly capacity, session length, and hours when students can book you.",
    href: "/dashboard/tutor/calendar#tutor-availability",
  },
];

type ProfileSetupRow = {
  tutor_bio: string | null;
  avatar_url: string | null;
  has_completed_tutor_setup: boolean;
};

async function loadProfileSetupRow(
  supabase: SupabaseClient,
  tutorId: string
): Promise<{ row: ProfileSetupRow | null; schemaReady: boolean }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("tutor_bio, avatar_url, has_completed_tutor_setup")
    .eq("id", tutorId)
    .single();

  if (!error) {
    return {
      row: {
        tutor_bio: data.tutor_bio ?? null,
        avatar_url: data.avatar_url ?? null,
        has_completed_tutor_setup: Boolean(data.has_completed_tutor_setup),
      },
      schemaReady: true,
    };
  }

  const message = error.message.toLowerCase();
  if (message.includes("tutor_bio") || message.includes("has_completed_tutor_setup")) {
    const fallback = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", tutorId)
      .single();

    if (fallback.error) {
      return { row: null, schemaReady: false };
    }

    return {
      row: {
        tutor_bio: null,
        avatar_url: fallback.data.avatar_url ?? null,
        has_completed_tutor_setup: false,
      },
      schemaReady: false,
    };
  }

  return { row: null, schemaReady: true };
}

async function markTutorSetupComplete(
  supabase: SupabaseClient,
  tutorId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({
      has_completed_tutor_setup: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tutorId);

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("has_completed_tutor_setup")) {
      return false;
    }
    throw error;
  }

  return true;
}

function deriveItemCompletion(
  profile: ProfileSetupRow | null,
  calendarConnected: boolean,
  hasAvailabilitySettings: boolean,
  hasAvailabilityWindows: boolean
): Record<TutorSetupItemId, boolean> {
  const bioText = profile?.tutor_bio?.trim() ?? "";
  return {
    bio: bioText.length >= MIN_BIO_LENGTH,
    photo: Boolean(profile?.avatar_url?.trim()),
    calendar: calendarConnected,
    availability: hasAvailabilitySettings && hasAvailabilityWindows,
  };
}

export async function loadTutorSetupStatus(
  supabase: SupabaseClient,
  tutorId: string
): Promise<TutorSetupStatus> {
  const [profileLoad, calendarStatus, settingsResult, windowsResult] = await Promise.all([
    loadProfileSetupRow(supabase, tutorId),
    loadTutorCalendarStatus(supabase),
    supabase
      .from("tutor_availability_settings")
      .select("tutor_id")
      .eq("tutor_id", tutorId)
      .maybeSingle(),
    supabase
      .from("tutor_availability_windows")
      .select("id")
      .eq("tutor_id", tutorId)
      .limit(1),
  ]);

  const availabilitySchemaMissing =
    isAvailabilitySchemaMissingError(settingsResult.error ?? {}) ||
    isAvailabilitySchemaMissingError(windowsResult.error ?? {});

  const hasAvailabilitySettings = Boolean(settingsResult.data);
  const hasAvailabilityWindows = (windowsResult.data?.length ?? 0) > 0;

  const completion = deriveItemCompletion(
    profileLoad.row,
    calendarStatus.connected,
    availabilitySchemaMissing ? false : hasAvailabilitySettings,
    availabilitySchemaMissing ? false : hasAvailabilityWindows
  );

  const items: TutorSetupItem[] = SETUP_ITEMS.map((item) => ({
    ...item,
    complete: completion[item.id],
  }));

  const completedCount = items.filter((item) => item.complete).length;
  const totalCount = items.length;
  const allComplete = completedCount === totalCount;
  let hasCompletedSetup = profileLoad.row?.has_completed_tutor_setup ?? false;

  if (allComplete && !hasCompletedSetup) {
    const marked = await markTutorSetupComplete(supabase, tutorId);
    if (marked) {
      hasCompletedSetup = true;
    }
  }

  return {
    showPrompt: !hasCompletedSetup,
    items,
    completedCount,
    totalCount,
  };
}
