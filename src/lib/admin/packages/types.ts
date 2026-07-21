import type {
  PackageInstanceStatus,
  PackageMembershipStatus,
} from "@/lib/admin/package-status";
import type { PackageTableColumnId } from "@/lib/admin/packages/table-columns";
import type { TutorIdSource } from "@/lib/notion/tutor-id-source";

export type AdminPackageKind = "cohort" | "package_instance" | "community";

export type PackagesRosterMember = {
  userId: string | null;
  label: string;
  email: string | null;
  avatarUrl: string | null;
  studentPackageId: string;
  membershipStatus: PackageMembershipStatus;
  /** Lead mirrored from Notion — status is read-only in the admin UI. */
  isNotionLead?: boolean;
  notionLeadPageId?: string | null;
};

export type CohortCalendarLinkState =
  | "linked"
  | "no_tutor"
  | "no_connection"
  | "unlinked"
  | "n_a";

export type CohortCalendarLinkedEvent = {
  title: string;
  startsAt: string;
  endsAt: string;
  recurringEventId: string;
};

export type AdminPackageListRow = {
  kind: AdminPackageKind;
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  packageId: string | null;
  tutorId: string | null;
  tutorName: string | null;
  tutorIdSource: TutorIdSource;
  status: PackageInstanceStatus;
  startDayOfWeek: string | null;
  startDate: string | null;
  endDate: string | null;
  capacity: number;
  deliveryMode: "group" | "one_to_one" | null;
  active: boolean;
  interested: PackagesRosterMember[];
  waitingForPayment: PackagesRosterMember[];
  confirmed: PackagesRosterMember[];
  lessonUnlockCount: number;
  lastLessonLoggedAt: string | null;
  /** Cohort weekly session (for calendar matching); null for non-cohorts. */
  weeklySessionStart: string | null;
  weeklySessionEnd: string | null;
  calendarLinkState: CohortCalendarLinkState;
  calendarNeedsAttention: boolean;
  /** Present when calendarLinkState === "linked". */
  calendarLinkedEvent: CohortCalendarLinkedEvent | null;
  /** Tutor Google Calendar last_synced_at, if connected. */
  tutorCalendarLastSyncedAt: string | null;
};

export type PackagesFilterField = "status" | "tutor" | "course" | "delivery_mode";

export type PackagesViewConfig = {
  search: string;
  filters: {
    status: PackageInstanceStatus[];
    tutorIds: string[];
    courseIds: string[];
    deliveryModes: Array<"group" | "one_to_one" | "community">;
  };
  groupBy: "none" | "status" | "tutor" | "course" | "format";
  sort: {
    field: "startDate" | "name" | "format";
    direction: "asc" | "desc";
  };
  columns: {
    hidden: PackageTableColumnId[];
  };
};

export const DEFAULT_PACKAGES_VIEW_CONFIG: PackagesViewConfig = {
  search: "",
  filters: {
    status: [],
    tutorIds: [],
    courseIds: [],
    deliveryModes: [],
  },
  groupBy: "none",
  sort: { field: "startDate", direction: "desc" },
  columns: { hidden: [] },
};

export type AdminSavedView = {
  id: string;
  name: string;
  viewType: string;
  config: PackagesViewConfig;
  createdBy: string;
  createdAt: string;
};

export type PackageLessonLogEntry = {
  lessonId: string;
  lessonNumber: number;
  lessonTitle: string;
  unlockedAt: string;
};

export type OnboardingChecklistRow = {
  id: string;
  checklistType: "group" | "one_to_one";
  timeAssigned: boolean;
  welcomeEmail: boolean;
  calendarInvite: boolean;
  tutorNotified: boolean;
  packageCreated: boolean;
  whatsappChatMade: boolean;
  scheduleWhatsappChat: boolean;
  onboardingCompleted: boolean;
  paymentDate: string | null;
  notes: string | null;
};

export type AdminPackageDetail = AdminPackageListRow & {
  active: boolean;
  packageId: string | null;
  packageName: string | null;
  lessonLog: PackageLessonLogEntry[];
};
