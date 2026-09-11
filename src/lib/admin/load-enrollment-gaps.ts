import "server-only";

import {
  MISSING_ACCESS_INSTANCE_STATUSES,
  type EnrollmentGapsSnapshot,
  type EnrollmentGrantQueueRow,
  type MissingAccessInstanceStatus,
  type MissingAccessRow,
} from "@/lib/admin/enrollment-gaps-types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type { EnrollmentGapsSnapshot, EnrollmentGrantQueueRow, MissingAccessRow };
export { MISSING_ACCESS_INSTANCE_STATUSES, notionPageHref } from "@/lib/admin/enrollment-gaps-types";

const PAGE_SIZE = 1000;

function asObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isMissingAccessStatus(value: string): value is MissingAccessInstanceStatus {
  return (MISSING_ACCESS_INSTANCE_STATUSES as readonly string[]).includes(value);
}

async function loadUnresolvedGrantQueue(
  supabase: SupabaseClient
): Promise<{ rows: EnrollmentGrantQueueRow[]; error?: string }> {
  const rows: EnrollmentGrantQueueRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("notion_lead_purchase_grant_queue")
      .select("id, profile_id, lead_name, lead_email, reason, created_at")
      .eq("resolved", false)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) return { rows: [], error: error.message };

    const page = data ?? [];
    for (const row of page) {
      rows.push({
        id: row.id as string,
        profileId: (row.profile_id as string | null) ?? null,
        leadName: (row.lead_name as string | null) ?? null,
        leadEmail: (row.lead_email as string | null) ?? null,
        reason: row.reason as string,
        createdAt: row.created_at as string,
      });
    }

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { rows };
}

async function loadMissingAccessInstances(
  supabase: SupabaseClient
): Promise<{ rows: MissingAccessRow[]; error?: string }> {
  type InstanceRow = {
    id: string;
    name: string;
    status: string;
    notion_page_id: string | null;
    course_id: string;
    courses: { name: string } | { name: string }[] | null;
  };

  const instances: InstanceRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("package_instances")
      .select("id, name, status, notion_page_id, course_id, courses(name)")
      .in("status", [...MISSING_ACCESS_INSTANCE_STATUSES])
      .eq("app_access_expected", true)
      .order("name", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) return { rows: [], error: error.message };

    const page = (data ?? []) as unknown as InstanceRow[];
    instances.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const enrolledIds = new Set<string>();
  for (let index = 0; index < instances.length; index += 80) {
    const chunk = instances.slice(index, index + 80).map((row) => row.id);
    if (chunk.length === 0) continue;
    const { data, error } = await supabase
      .from("student_packages")
      .select("package_instance_id")
      .in("package_instance_id", chunk);
    if (error) return { rows: [], error: error.message };
    for (const row of data ?? []) {
      const instanceId = row.package_instance_id as string | null;
      if (instanceId) enrolledIds.add(instanceId);
    }
  }

  const rows: MissingAccessRow[] = instances.flatMap((row) => {
    if (enrolledIds.has(row.id)) return [];
    if (!isMissingAccessStatus(row.status)) return [];
    const course = asObject(row.courses);
    return [
      {
        id: row.id,
        name: row.name,
        status: row.status,
        notionPageId: row.notion_page_id,
        courseId: row.course_id,
        courseName: course?.name?.trim() || row.course_id,
      },
    ];
  });

  return { rows };
}

export async function loadEnrollmentGaps(
  supabase: SupabaseClient
): Promise<EnrollmentGapsSnapshot> {
  const [grantQueue, missingAccess] = await Promise.all([
    loadUnresolvedGrantQueue(supabase),
    loadMissingAccessInstances(supabase),
  ]);

  const error = grantQueue.error ?? missingAccess.error;
  return {
    grantQueue: grantQueue.rows,
    missingAccess: missingAccess.rows,
    error,
  };
}
