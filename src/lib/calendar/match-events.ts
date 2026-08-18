import type { GoogleCalendarEvent } from "@/lib/calendar/types";

export type TutorStudentMatchCandidate = {
  studentId: string;
  email: string;
  displayName: string;
  cohortId: string | null;
  courseId: string;
  deliveryMode: "one_to_one" | "group" | null;
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

export function titleContainsName(title: string, displayName: string): boolean {
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
    if (!existing) {
      byId.set(student.studentId, student);
      continue;
    }

    const preferNew =
      (!existing.email && student.email) ||
      (student.deliveryMode === "group" && existing.deliveryMode !== "group");
    if (preferNew) {
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

function sessionForStudent(
  student: TutorStudentMatchCandidate,
  matchMethod: SessionMatchResult["matchMethod"]
): SessionMatchResult {
  if (student.deliveryMode === "group" && student.cohortId) {
    return {
      studentId: null,
      cohortId: student.cohortId,
      courseId: student.courseId,
      matchMethod,
    };
  }

  return {
    studentId: student.studentId,
    cohortId: null,
    courseId: student.courseId,
    matchMethod,
  };
}

function cohortSessionFromStudents(
  groupStudents: TutorStudentMatchCandidate[],
  cohorts: TutorCohortMatchCandidate[],
  matchMethod: SessionMatchResult["matchMethod"]
): SessionMatchResult | null {
  const cohortIds = [...new Set(groupStudents.map((student) => student.cohortId).filter(Boolean))];
  if (cohortIds.length !== 1) return null;

  const cohortId = cohortIds[0]!;
  const cohort = cohorts.find((entry) => entry.cohortId === cohortId);
  return {
    studentId: null,
    cohortId,
    courseId: cohort?.courseId ?? groupStudents[0]?.courseId ?? null,
    matchMethod,
  };
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
    return sessionForStudent(matchedByEmail[0], "attendee_email");
  }

  if (matchedByEmail.length > 1) {
    const groupStudents = matchedByEmail.filter(
      (student) => student.deliveryMode === "group" && student.cohortId
    );
    const oneToOneStudents = matchedByEmail.filter(
      (student) => student.deliveryMode !== "group"
    );

    const cohortFromGroup = cohortSessionFromStudents(groupStudents, cohorts, "attendee_email");
    if (cohortFromGroup && oneToOneStudents.length === 0) {
      return cohortFromGroup;
    }

    if (oneToOneStudents.length === 1 && groupStudents.length === 0) {
      return sessionForStudent(oneToOneStudents[0], "attendee_email");
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
    return sessionForStudent(titleMatches[0], "title_name");
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
