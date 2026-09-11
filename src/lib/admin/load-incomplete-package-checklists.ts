import "server-only";

import { includeIncompleteChecklistForAppAccess } from "@/lib/admin/app-access-expected";
import type { IncompletePackageChecklistRow } from "@/lib/admin/incomplete-package-checklist-types";
import type { PackageMembershipStatus } from "@/lib/admin/package-status";
import type { OnboardingChecklistRow } from "@/lib/admin/packages/types";
import { ONBOARDING_CHECKLIST_PROGRESS_KEYS } from "@/lib/admin/onboarding/types";
import { getStaffFacingName } from "@/lib/profile/display-name";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { IncompletePackageChecklistRow };

const PACKAGE_ONBOARDING_STALE_MS = 7 * 24 * 60 * 60 * 1000;

const FLAG_LABELS: Record<(typeof ONBOARDING_CHECKLIST_PROGRESS_KEYS)[number], string> = {
  timeAssigned: "Time assigned",
  welcomeEmail: "Welcome email",
  calendarInvite: "Calendar invite",
  tutorNotified: "Tutor notified",
  packageCreated: "Package created",
  whatsappChatMade: "WhatsApp chat",
  scheduleWhatsappChat: "Schedule WhatsApp",
};

function asObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function loadEmailsById(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string | null>> {
  const wanted = new Set(userIds);
  const emailById = new Map<string, string | null>();
  if (wanted.size === 0) return emailById;

  for (let page = 1; page <= 10 && emailById.size < wanted.size; page += 1) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const user of users) {
      if (!wanted.has(user.id)) continue;
      emailById.set(user.id, user.email ?? null);
    }
    if (users.length < 1000) break;
  }
  return emailById;
}

export async function loadIncompletePackageChecklists(supabase: SupabaseClient): Promise<{
  rows: IncompletePackageChecklistRow[];
  error?: string;
}> {
  const nowMs = Date.now();
  const { data, error } = await supabase
    .from("onboarding_checklists")
    .select(
      "id, student_package_id, checklist_type, created_at, time_assigned, welcome_email, calendar_invite, tutor_notified, package_created, whatsapp_chat_made, schedule_whatsapp_chat, onboarding_completed, payment_date, notes, student_packages(id, user_id, status, package_instance_id, packages(name), courses(name))"
    )
    .eq("onboarding_completed", false)
    .order("created_at", { ascending: true });

  if (error) return { rows: [], error: error.message };

  type StudentPackageJoin = {
    id: string;
    user_id: string | null;
    status: string | null;
    package_instance_id: string | null;
    packages: { name: string } | { name: string }[] | null;
    courses: { name: string } | { name: string }[] | null;
  };

  const packageRows = (data ?? []).map((row) => {
    const studentPackage = asObject(row.student_packages as StudentPackageJoin | StudentPackageJoin[] | null);
    return { row, studentPackage };
  });

  const instanceIds = [
    ...new Set(
      packageRows
        .map((entry) => entry.studentPackage?.package_instance_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const userIds = [
    ...new Set(
      packageRows
        .map((entry) => entry.studentPackage?.user_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [{ data: profiles, error: profileError }, emailById, expectedByInstanceId] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id, full_name, preferred_name").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null; preferred_name: string | null }>, error: null }),
    loadEmailsById(supabase, userIds),
    loadAppAccessExpectedByInstanceId(supabase, instanceIds),
  ]);

  if (profileError) return { rows: [], error: profileError.message };
  if (expectedByInstanceId.error) return { rows: [], error: expectedByInstanceId.error };

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));

  const rows: IncompletePackageChecklistRow[] = packageRows.flatMap(({ row, studentPackage }) => {
    const packageInstanceId = studentPackage?.package_instance_id ?? null;
    if (
      !includeIncompleteChecklistForAppAccess({
        packageInstanceId,
        instanceAppAccessExpected: packageInstanceId
          ? expectedByInstanceId.byId.get(packageInstanceId)
          : undefined,
      })
    ) {
      return [];
    }

    const userId = studentPackage?.user_id ?? null;
    const profile = userId ? profileById.get(userId) : undefined;
    const email = userId ? emailById.get(userId) ?? null : null;
    const checklist: OnboardingChecklistRow = {
      id: row.id as string,
      checklistType: (row.checklist_type as "group" | "one_to_one") ?? "one_to_one",
      timeAssigned: Boolean(row.time_assigned),
      welcomeEmail: Boolean(row.welcome_email),
      calendarInvite: Boolean(row.calendar_invite),
      tutorNotified: Boolean(row.tutor_notified),
      packageCreated: Boolean(row.package_created),
      whatsappChatMade: Boolean(row.whatsapp_chat_made),
      scheduleWhatsappChat: Boolean(row.schedule_whatsapp_chat),
      onboardingCompleted: Boolean(row.onboarding_completed),
      paymentDate: (row.payment_date as string | null) ?? null,
      notes: (row.notes as string | null) ?? null,
    };
    const outstandingLabels = ONBOARDING_CHECKLIST_PROGRESS_KEYS.filter(
      (key) => !checklist[key]
    ).map((key) => FLAG_LABELS[key]);
    const createdAt = (row.created_at as string) ?? new Date(0).toISOString();
    const pkg = asObject(studentPackage?.packages);
    const course = asObject(studentPackage?.courses);

    return [
      {
        checklistId: row.id as string,
        studentPackageId: row.student_package_id as string,
        packageInstanceId,
        userId,
        displayName:
          getStaffFacingName(profile) ?? email ?? (userId ? "Student" : "No account yet"),
        email,
        courseName: course?.name ?? "—",
        packageName: pkg?.name ?? "—",
        membershipStatus: (studentPackage?.status as PackageMembershipStatus | null) ?? null,
        checklistType: checklist.checklistType,
        createdAt,
        stale: nowMs - new Date(createdAt).getTime() >= PACKAGE_ONBOARDING_STALE_MS,
        checklist,
        outstandingLabels,
      },
    ];
  });

  return { rows };
}

async function loadAppAccessExpectedByInstanceId(
  supabase: SupabaseClient,
  instanceIds: string[]
): Promise<{ byId: Map<string, boolean | null>; error?: string }> {
  const byId = new Map<string, boolean | null>();
  if (instanceIds.length === 0) return { byId };

  for (let index = 0; index < instanceIds.length; index += 80) {
    const chunk = instanceIds.slice(index, index + 80);
    const { data, error } = await supabase
      .from("package_instances")
      .select("id, app_access_expected")
      .in("id", chunk);
    if (error) return { byId, error: error.message };
    for (const row of data ?? []) {
      byId.set(row.id as string, (row.app_access_expected as boolean | null) ?? null);
    }
  }

  return { byId };
}
