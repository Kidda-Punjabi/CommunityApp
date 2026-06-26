import type { GoogleCalendarEvent } from "@/lib/calendar/types";

export type TutorStudentMatchCandidate = {
  studentId: string;
  email: string;
  displayName: string;
  cohortId: string | null;
  courseId: string;
};

export type TutorCohortMatchCandidate = {
  cohortId: string;
  cohortName: string;
  courseId: string;
  memberEmails: string[];
};

export type SessionMatchResult = {
  studentId: string | null;
  cohortId: string | null;
  courseId: string | null;
  matchMethod: "attendee_email" | "title_name" | "unmatched";
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function titleContainsName(title: string, displayName: string): boolean {
  const normalizedTitle = title.toLowerCase();
  const normalizedName = displayName.trim().toLowerCase();
  if (normalizedName.length < 2) return false;

  if (normalizedTitle.includes(normalizedName)) return true;

  const nameParts = normalizedName.split(/\s+/).filter(Boolean);
  if (nameParts.length >= 2) {
    const firstName = nameParts[0]!;
    const lastName = nameParts[nameParts.length - 1]!;
    return normalizedTitle.includes(firstName) && normalizedTitle.includes(lastName);
  }

  const firstName = nameParts[0];
  if (!firstName || firstName.length < 3) return false;
  return normalizedTitle.includes(firstName);
}

function uniqueStudentsById(
  students: TutorStudentMatchCandidate[]
): TutorStudentMatchCandidate[] {
  const byId = new Map<string, TutorStudentMatchCandidate>();
  for (const student of students) {
    const existing = byId.get(student.studentId);
    if (!existing || (!existing.email && student.email)) {
      byId.set(student.studentId, student);
    }
  }
  return [...byId.values()];
}

function matchStudentsByAttendeeEmails(
  students: TutorStudentMatchCandidate[],
  attendeeSet: Set<string>
): TutorStudentMatchCandidate[] {
  const matched: TutorStudentMatchCandidate[] = [];
  const seenStudentIds = new Set<string>();

  for (const student of students) {
    if (!student.email) continue;
    if (!attendeeSet.has(normalizeEmail(student.email))) continue;
    if (seenStudentIds.has(student.studentId)) continue;
    seenStudentIds.add(student.studentId);
    matched.push(student);
  }

  return matched;
}

export function matchEventToStudents(
  event: GoogleCalendarEvent,
  students: TutorStudentMatchCandidate[],
  cohorts: TutorCohortMatchCandidate[]
): SessionMatchResult {
  const dedupedStudents = uniqueStudentsById(students);
  const attendeeSet = new Set(event.attendeeEmails.map(normalizeEmail));
  const matchedByEmail = matchStudentsByAttendeeEmails(dedupedStudents, attendeeSet);

  if (matchedByEmail.length === 1) {
    const student = matchedByEmail[0];
    return {
      studentId: student.studentId,
      cohortId: null,
      courseId: student.courseId,
      matchMethod: "attendee_email",
    };
  }

  if (matchedByEmail.length > 1) {
    const cohortIds = [...new Set(matchedByEmail.map((s) => s.cohortId).filter(Boolean))];
    if (cohortIds.length === 1) {
      const cohortId = cohortIds[0]!;
      const cohort = cohorts.find((c) => c.cohortId === cohortId);
      return {
        studentId: null,
        cohortId,
        courseId: cohort?.courseId ?? matchedByEmail[0].courseId,
        matchMethod: "attendee_email",
      };
    }
  }

  for (const cohort of cohorts) {
    const overlap = cohort.memberEmails.filter((email) =>
      attendeeSet.has(normalizeEmail(email))
    );
    if (overlap.length >= 2) {
      return {
        studentId: null,
        cohortId: cohort.cohortId,
        courseId: cohort.courseId,
        matchMethod: "attendee_email",
      };
    }
  }

  const titleMatches = dedupedStudents.filter((student) =>
    titleContainsName(event.summary, student.displayName)
  );

  if (titleMatches.length === 1) {
    const student = titleMatches[0];
    return {
      studentId: student.studentId,
      cohortId: null,
      courseId: student.courseId,
      matchMethod: "title_name",
    };
  }

  for (const cohort of cohorts) {
    if (titleContainsName(event.summary, cohort.cohortName)) {
      return {
        studentId: null,
        cohortId: cohort.cohortId,
        courseId: cohort.courseId,
        matchMethod: "title_name",
      };
    }
  }

  return {
    studentId: null,
    cohortId: null,
    courseId: null,
    matchMethod: "unmatched",
  };
}
