export type LessonLogUnlockTarget = {
  studentId: string | null;
  kidProfileId: string | null;
};

/**
 * Who should receive a 1-1 unlock when an admin approves a review row.
 * Attendance written at log time wins. If the log has no marks, the package's
 * current students are unlocked so a lesson without a calendar event is not stuck.
 */
export function lessonLogUnlockTargets(input: {
  attendance: Array<{ student_id: string | null; kid_profile_id: string | null }>;
  packageStudentIds: string[];
}): LessonLogUnlockTarget[] {
  const fromAttendance = input.attendance.flatMap((row): LessonLogUnlockTarget[] => {
    if (row.kid_profile_id) return [{ studentId: null, kidProfileId: row.kid_profile_id }];
    if (row.student_id) return [{ studentId: row.student_id, kidProfileId: null }];
    return [];
  });
  if (fromAttendance.length > 0) return fromAttendance;
  return input.packageStudentIds.map((studentId) => ({ studentId, kidProfileId: null }));
}
