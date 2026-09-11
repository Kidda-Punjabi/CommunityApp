import type { PackageInstanceStatus } from "@/lib/admin/package-status";

export const MISSING_ACCESS_INSTANCE_STATUSES = [
  "scheduled",
  "in_progress",
  "paused",
  "postponed",
] as const satisfies readonly PackageInstanceStatus[];

export type MissingAccessInstanceStatus = (typeof MISSING_ACCESS_INSTANCE_STATUSES)[number];

export type EnrollmentGrantQueueRow = {
  id: string;
  profileId: string | null;
  leadName: string | null;
  leadEmail: string | null;
  reason: string;
  createdAt: string;
};

export type MissingAccessRow = {
  id: string;
  name: string;
  status: MissingAccessInstanceStatus;
  notionPageId: string | null;
  courseId: string;
  courseName: string;
};

export type EnrollmentGapsSnapshot = {
  grantQueue: EnrollmentGrantQueueRow[];
  missingAccess: MissingAccessRow[];
  error?: string;
};

export function notionPageHref(notionPageId: string): string {
  return `https://notion.so/${notionPageId.replace(/-/g, "")}`;
}
