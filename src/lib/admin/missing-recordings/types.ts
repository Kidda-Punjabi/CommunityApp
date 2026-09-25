export type MissingRecordingKind = "one_to_one" | "group";

export type MissingRecordingReason =
  | "software_failed"
  | "student_no_consent"
  | "lesson_did_not_happen"
  | "other";

export type MissingRecordingCounts = {
  total: number;
  one_to_one: number;
  group: number;
};

export type MissingRecordingRow = {
  entry_id: string;
  kind: MissingRecordingKind;
  target_name: string | null;
  student_name: string | null;
  tutor_name: string | null;
  lesson_date: string;
  lesson_title: string | null;
  due_at: string;
  recording_dismissed_at: string | null;
  recording_dismissed_by: string | null;
  recording_dismissed_by_name: string | null;
  recording_dismiss_reason: MissingRecordingReason | null;
  recording_dismiss_note: string | null;
};

export const MISSING_RECORDING_REASONS: Array<{
  value: MissingRecordingReason;
  label: string;
}> = [
  { value: "software_failed", label: "Software failed" },
  { value: "student_no_consent", label: "Student did not consent" },
  { value: "lesson_did_not_happen", label: "Lesson did not happen" },
  { value: "other", label: "Other" },
];

export function missingRecordingReasonLabel(reason: string | null): string {
  return MISSING_RECORDING_REASONS.find((item) => item.value === reason)?.label ?? "Dismissed";
}
