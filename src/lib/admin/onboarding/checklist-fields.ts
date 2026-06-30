import type { OnboardingChecklistRow } from "@/lib/admin/packages/types";

export const ONBOARDING_CHECKLIST_COLUMNS: Array<{
  key: keyof OnboardingChecklistRow;
  label: string;
  header: string;
}> = [
  { key: "timeAssigned", label: "Time assigned", header: "Time" },
  { key: "welcomeEmail", label: "Welcome email", header: "Welcome" },
  { key: "calendarInvite", label: "Calendar invite", header: "Calendar" },
  { key: "tutorNotified", label: "Tutor notified", header: "Tutor ✓" },
  { key: "packageCreated", label: "Package created", header: "Pkg ✓" },
  { key: "whatsappChatMade", label: "WhatsApp chat made", header: "WhatsApp" },
  { key: "scheduleWhatsappChat", label: "Schedule WhatsApp chat", header: "Sched. WA" },
  { key: "onboardingCompleted", label: "Onboarding completed", header: "Done" },
];

export const ONBOARDING_CHECKLIST_TOGGLE_KEYS = ONBOARDING_CHECKLIST_COLUMNS.map(
  (column) => column.key
) as Array<keyof OnboardingChecklistRow>;

export function isChecklistToggleKey(
  key: keyof OnboardingChecklistRow
): key is Extract<keyof OnboardingChecklistRow, boolean | unknown> {
  return ONBOARDING_CHECKLIST_TOGGLE_KEYS.includes(key);
}
