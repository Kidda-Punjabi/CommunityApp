import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actorCourseKey,
  assignPendingToPackages,
  buildOneToOneHomeworkPackages,
  countPendingFromAssignments,
  encodeHomeworkPackageId,
  homeworkEnrollmentActorId,
  homeworkLessonWeekLabel,
  isGroupCohortEnrollment,
  occupiedActorCourseKeysFromCohorts,
  parseHomeworkPackageId,
  pendingBadgeLabel,
  type HomeworkPackageEnrollment,
} from "./homework-review-packages";

function enrollment(
  overrides: Partial<HomeworkPackageEnrollment> & Pick<HomeworkPackageEnrollment, "enrollmentId" | "userId">
): HomeworkPackageEnrollment {
  return {
    kidProfileId: null,
    courseId: "course-foundational",
    courseName: "Foundational Course",
    deliveryMode: "one_to_one",
    cohortId: null,
    packageInstanceId: null,
    packageInstanceName: null,
    actorName: "Student",
    ...overrides,
  };
}

describe("homework package ids", () => {
  it("round-trips cohort, instance, and enrollment refs", () => {
    const cohort = encodeHomeworkPackageId({ kind: "cohort", id: "c1" });
    const instance = encodeHomeworkPackageId({ kind: "instance", id: "i1" });
    const row = encodeHomeworkPackageId({ kind: "enrollment", id: "e1" });
    assert.deepEqual(parseHomeworkPackageId(cohort), { kind: "cohort", id: "c1" });
    assert.deepEqual(parseHomeworkPackageId(instance), { kind: "instance", id: "i1" });
    assert.deepEqual(parseHomeworkPackageId(row), { kind: "enrollment", id: "e1" });
  });

  it("rejects unknown prefixes", () => {
    assert.equal(parseHomeworkPackageId("tutor:abc"), null);
    assert.equal(parseHomeworkPackageId("cohort:"), null);
  });
});

describe("buildOneToOneHomeworkPackages", () => {
  it("keeps unlinked 1-1 enrollments on the same course as separate packages", () => {
    const packages = buildOneToOneHomeworkPackages(
      [
        enrollment({
          enrollmentId: "e-brodie",
          userId: "brodie",
          actorName: "Brodie",
          packageInstanceName: "Brodie - 1-1 Beginner Course",
        }),
        enrollment({
          enrollmentId: "e-christina",
          userId: "christina",
          actorName: "Christina",
        }),
      ],
      new Set()
    );

    assert.equal(packages.length, 2);
    assert.deepEqual(
      packages.map((pack) => pack.id).sort(),
      [
        encodeHomeworkPackageId({ kind: "enrollment", id: "e-brodie" }),
        encodeHomeworkPackageId({ kind: "enrollment", id: "e-christina" }),
      ].sort()
    );
    assert.equal(packages.every((pack) => pack.students.length === 1), true);
  });

  it("groups students who share a live package_instance_id as one private class", () => {
    const packages = buildOneToOneHomeworkPackages(
      [
        enrollment({
          enrollmentId: "e-a",
          userId: "parent",
          kidProfileId: "kid-a",
          courseId: "kids-beginners",
          courseName: "Kids Beginners",
          actorName: "Harteer",
          packageInstanceId: "private-1to3",
          packageInstanceName: "Harteer, Hartegh and Prabhbir - 1-to-3 Beginner Course",
        }),
        enrollment({
          enrollmentId: "e-b",
          userId: "parent",
          kidProfileId: "kid-b",
          courseId: "kids-beginners",
          courseName: "Kids Beginners",
          actorName: "Hartegh",
          packageInstanceId: "private-1to3",
          packageInstanceName: "Harteer, Hartegh and Prabhbir - 1-to-3 Beginner Course",
        }),
        enrollment({
          enrollmentId: "e-c",
          userId: "parent",
          kidProfileId: "kid-c",
          courseId: "kids-beginners",
          courseName: "Kids Beginners",
          actorName: "Prabhbir",
          packageInstanceId: "private-1to3",
          packageInstanceName: "Harteer, Hartegh and Prabhbir - 1-to-3 Beginner Course",
        }),
      ],
      new Set()
    );

    assert.equal(packages.length, 1);
    assert.equal(packages[0]?.id, encodeHomeworkPackageId({ kind: "instance", id: "private-1to3" }));
    assert.equal(packages[0]?.kind, "one_to_one");
    assert.deepEqual(
      packages[0]?.students.map((student) => student.studentId).sort(),
      ["kid-a", "kid-b", "kid-c"]
    );
    assert.equal(packages[0]?.name, "Harteer, Hartegh and Prabhbir - 1-to-3 Beginner Course");
  });

  it("does not list a 1-1 enrollment already covered by a group cohort on the same course", () => {
    const occupied = occupiedActorCourseKeysFromCohorts([
      {
        courseId: "kids-beginners",
        students: [{ studentId: "kid-a", studentName: "Harteer" }],
      },
    ]);
    const packages = buildOneToOneHomeworkPackages(
      [
        enrollment({
          enrollmentId: "e-a",
          userId: "parent",
          kidProfileId: "kid-a",
          courseId: "kids-beginners",
          courseName: "Kids Beginners",
          actorName: "Harteer",
          packageInstanceId: "private-1to3",
        }),
      ],
      occupied
    );
    assert.equal(packages.length, 0);
  });

  it("skips group cohort enrollments", () => {
    const packages = buildOneToOneHomeworkPackages(
      [
        enrollment({
          enrollmentId: "e-group",
          userId: "student",
          deliveryMode: "group",
          cohortId: "cohort-39",
          actorName: "Group student",
        }),
      ],
      new Set()
    );
    assert.equal(packages.length, 0);
  });
});

describe("assignPendingToPackages counts", () => {
  it("keeps the Need to review total equal to the sum of package and lesson badges", () => {
    const cohortId = encodeHomeworkPackageId({ kind: "cohort", id: "c39" });
    const soloId = encodeHomeworkPackageId({ kind: "enrollment", id: "e-solo" });
    const privateId = encodeHomeworkPackageId({ kind: "instance", id: "private-1to3" });
    const packages = [
      {
        id: cohortId,
        students: [
          { studentId: "s1" },
          { studentId: "s2" },
        ],
        lessons: [{ id: "l1" }, { id: "l2" }],
      },
      {
        id: soloId,
        students: [{ studentId: "solo" }],
        lessons: [{ id: "l1" }, { id: "l3" }],
      },
      {
        id: privateId,
        students: [{ studentId: "kid-a" }, { studentId: "kid-b" }],
        lessons: [{ id: "l4" }],
      },
    ];

    const assignments = assignPendingToPackages(packages, [
      { id: "p1", studentId: "s1", lessonId: "l1" },
      { id: "p2", studentId: "s2", lessonId: "l1" },
      { id: "p3", studentId: "s1", lessonId: "l2" },
      { id: "p4", studentId: "solo", lessonId: "l3" },
      { id: "p5", studentId: "kid-a", lessonId: "l4" },
      { id: "p6", studentId: "kid-b", lessonId: "l4" },
      { id: "orphan", studentId: "other-tutor-student", lessonId: "l1" },
    ]);

    const counts = countPendingFromAssignments(assignments);
    assert.equal(counts.global, 6);
    assert.equal(
      Object.values(counts.byPackage).reduce((sum, value) => sum + value, 0),
      counts.global
    );
    assert.equal(
      Object.values(counts.byLesson).reduce((sum, value) => sum + value, 0),
      counts.global
    );
    assert.equal(counts.byPackage[cohortId], 3);
    assert.equal(counts.byPackage[soloId], 1);
    assert.equal(counts.byPackage[privateId], 2);
    assert.equal(counts.byLesson[`${cohortId}:l1`], 2);
    assert.equal(assignments.some((row) => row.submissionId === "orphan"), false);
  });
});

describe("helpers", () => {
  it("uses kid_profile_id as the homework actor when present", () => {
    assert.equal(
      homeworkEnrollmentActorId(
        enrollment({ enrollmentId: "e", userId: "parent", kidProfileId: "kid" })
      ),
      "kid"
    );
  });

  it("treats group+cohort as a group enrollment", () => {
    assert.equal(
      isGroupCohortEnrollment(
        enrollment({
          enrollmentId: "e",
          userId: "u",
          deliveryMode: "group",
          cohortId: "c",
        })
      ),
      true
    );
    assert.equal(
      isGroupCohortEnrollment(enrollment({ enrollmentId: "e", userId: "u" })),
      false
    );
  });

  it("reads week labels from titles when present", () => {
    assert.equal(homeworkLessonWeekLabel(2, "Sentence Structure - Week 2"), "Week 2");
    assert.equal(homeworkLessonWeekLabel(1, "Greetings"), "Week 1");
  });

  it("labels pending badges", () => {
    assert.equal(pendingBadgeLabel(0), "up to date");
    assert.equal(pendingBadgeLabel(4), "4 to review");
  });

  it("builds occupied actor+course keys from cohort packages", () => {
    const keys = occupiedActorCourseKeysFromCohorts([
      {
        courseId: "kids-beginners",
        students: [{ studentId: "kid-a", studentName: "Harteer" }],
      },
    ]);
    assert.equal(keys.has(actorCourseKey("kid-a", "kids-beginners")), true);
  });
});
