import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildGameDeckSummaries,
  decksForWeek,
  lessonIdsTaughtToStudent,
  resolveDeckWeekNumber,
  sortedWeekNumbers,
  type DeckListLesson,
  type DeckListSet,
} from "./game-deck-weeks";

const BEGINNERS = "beginners-course";
const COMMUNITY = "community-course";

function lesson(
  id: string,
  lessonNumber: number,
  courseId = BEGINNERS
): DeckListLesson {
  return {
    id,
    courseId,
    lessonNumber,
    title: `Lesson ${lessonNumber}`,
    isFree: false,
    courseName: courseId === COMMUNITY ? "Kidda Community" : "Beginners Course",
    courseTier: courseId === COMMUNITY ? "community" : "beginners",
    isPublicCourse: true,
  };
}

function set(id: string, name: string, weekNumber: number | null, cardCount: number): DeckListSet {
  return { id, name, weekNumber, cardCount };
}

describe("resolveDeckWeekNumber", () => {
  it("prefers flashcard_sets.week_number", () => {
    assert.equal(resolveDeckWeekNumber(4, 9), 4);
  });

  it("falls back to the linked lesson number", () => {
    assert.equal(resolveDeckWeekNumber(null, 13), 13);
    assert.equal(resolveDeckWeekNumber(undefined, 13), 13);
  });
});

describe("buildGameDeckSummaries", () => {
  const lessons = [1, 2, 3, 4, 5].map((week) => lesson(`lesson-${week}`, week));
  const sets = [
    set("vocab-1", "Vocabulary - Week 1", 1, 25),
    set("vocab-4", "Vocabulary - Week 4", 4, 60),
    set("ability", "Week 4 - Ability-Based Sentences", 4, 10),
    set("complex", "Week 4 - Complex Sentences", 4, 12),
    set("vocab", "Week 4 - Vocab", 4, 20),
    set("connecting", "Week 4 - Vocab - Connecting Words", 4, 15),
    set("vocab-5", "Vocabulary - Week 5", 5, 28),
    set("empty", "Empty Week 4", 4, 0),
  ];
  const links = [
    ...sets.map((item) => ({
      deckId: item.id,
      lessonId: `lesson-${item.weekNumber}`,
    })),
    { deckId: "vocab-4", lessonId: null },
    { deckId: "vocab-1", lessonId: "lesson-1" },
  ];

  const taught = lessonIdsTaughtToStudent({
    lessons: lessons.map((item) => ({
      id: item.id,
      courseId: item.courseId,
      isFree: item.isFree,
    })),
    courses: [
      {
        id: BEGINNERS,
        name: "Beginners Course",
        requiredTier: "beginners",
        isPublic: true,
      },
    ],
    enrollments: [
      {
        courseId: BEGINNERS,
        deliveryMode: "group",
        cohortId: "cohort-1",
        cohortStatus: "in_progress",
      },
    ],
    cohortUnlocks: [1, 2, 3, 4].map((week) => ({
      cohortId: "cohort-1",
      lessonId: `lesson-${week}`,
    })),
    studentUnlockLessonIds: new Set(),
    adminPreviewCourseIds: new Set(),
  });

  const decks = buildGameDeckSummaries({
    lessons,
    links,
    sets,
    unlockedCourseIds: new Set([BEGINNERS]),
    taughtLessonIds: taught,
    englishCourseIds: null,
  });

  it("lists unlocked weeks in week order, then name, with full card counts", () => {
    assert.deepEqual(
      decks.map((deck) => [deck.weekNumber, deck.setName, deck.cardCount]),
      [
        [1, "Vocabulary - Week 1", 25],
        [4, "Vocabulary - Week 4", 60],
        [4, "Week 4 - Ability-Based Sentences", 10],
        [4, "Week 4 - Complex Sentences", 12],
        [4, "Week 4 - Vocab", 20],
        [4, "Week 4 - Vocab - Connecting Words", 15],
      ]
    );
  });

  it("hides locked weeks and ignores course-only links", () => {
    assert.equal(
      decks.some((deck) => deck.setName === "Vocabulary - Week 5"),
      false
    );
    assert.equal(decks.filter((deck) => deck.deckId === "vocab-1").length, 1);
    assert.equal(decks.filter((deck) => deck.deckId === "vocab-4").length, 1);
  });

  it("filters to a single week with no all-weeks option", () => {
    const week4 = decksForWeek(decks, 4);
    assert.deepEqual(sortedWeekNumbers(decks), [1, 4]);
    assert.ok(week4.every((deck) => deck.weekNumber === 4));
    assert.equal(week4.find((deck) => deck.setName === "Vocabulary - Week 4")?.cardCount, 60);
    assert.equal(decksForWeek(decks, 1)[0]?.cardCount, 25);
    assert.equal(decksForWeek(decks, 5).length, 0);
  });

  it("uses the lesson number when the set has no week", () => {
    const communityLesson = lesson("community-13", 13, COMMUNITY);
    const summaries = buildGameDeckSummaries({
      lessons: [communityLesson],
      links: [{ deckId: "community-set", lessonId: communityLesson.id }],
      sets: [set("community-set", "Week 13 - Describing People (Community)", null, 8)],
      unlockedCourseIds: new Set([COMMUNITY]),
      taughtLessonIds: new Set([communityLesson.id]),
      englishCourseIds: null,
    });
    assert.equal(summaries[0]?.weekNumber, 13);
  });

  it("uses student unlocks for 1:1 and ignores another cohort's unlocks", () => {
    const taughtIds = lessonIdsTaughtToStudent({
      lessons: [
        { id: "lesson-1", courseId: BEGINNERS, isFree: false },
        { id: "lesson-2", courseId: BEGINNERS, isFree: false },
      ],
      courses: [
        {
          id: BEGINNERS,
          name: "Beginners Course",
          requiredTier: "beginners",
          isPublic: true,
        },
      ],
      enrollments: [{ courseId: BEGINNERS, deliveryMode: "one_to_one", cohortId: null }],
      cohortUnlocks: [{ cohortId: "other-cohort", lessonId: "lesson-2" }],
      studentUnlockLessonIds: new Set(["lesson-1"]),
      adminPreviewCourseIds: new Set(),
    });
    assert.deepEqual([...taughtIds], ["lesson-1"]);
  });

  it("shows every week when the student has course access but no unlock rows", () => {
    const taughtIds = lessonIdsTaughtToStudent({
      lessons: lessons.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        isFree: item.isFree,
      })),
      courses: [
        {
          id: BEGINNERS,
          name: "Beginners Course",
          requiredTier: "beginners",
          isPublic: true,
        },
      ],
      enrollments: [],
      cohortUnlocks: [],
      studentUnlockLessonIds: new Set(),
      adminPreviewCourseIds: new Set(),
    });
    assert.deepEqual(
      [...taughtIds].sort(),
      lessons.map((item) => item.id).sort()
    );
  });

  it("shows every week when the cohort is finished, even if old unlocks exist", () => {
    const taughtIds = lessonIdsTaughtToStudent({
      lessons: lessons.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        isFree: item.isFree,
      })),
      courses: [
        {
          id: BEGINNERS,
          name: "Beginners Course",
          requiredTier: "beginners",
          isPublic: true,
        },
      ],
      enrollments: [
        {
          courseId: BEGINNERS,
          deliveryMode: "group",
          cohortId: "cohort-28",
          cohortStatus: "offboarding_complete",
        },
      ],
      cohortUnlocks: [1, 2].map((week) => ({
        cohortId: "cohort-28",
        lessonId: `lesson-${week}`,
      })),
      studentUnlockLessonIds: new Set(),
      adminPreviewCourseIds: new Set(),
    });
    assert.equal(taughtIds.has("lesson-5"), true);
  });

  it("shows every week when an active cohort has no unlock records", () => {
    const taughtIds = lessonIdsTaughtToStudent({
      lessons: [{ id: "lesson-1", courseId: BEGINNERS, isFree: false }],
      courses: [
        {
          id: BEGINNERS,
          name: "Beginners Course",
          requiredTier: "beginners",
          isPublic: true,
        },
      ],
      enrollments: [
        {
          courseId: BEGINNERS,
          deliveryMode: "group",
          cohortId: "cohort-empty",
          cohortStatus: "in_progress",
        },
      ],
      cohortUnlocks: [],
      studentUnlockLessonIds: new Set(),
      adminPreviewCourseIds: new Set(),
    });
    assert.deepEqual([...taughtIds], ["lesson-1"]);
  });

  it("opens every community lesson when that course has no unlock rows", () => {
    const communityLessons = [1, 2, 24].map((week) => ({
      id: `community-${week}`,
      courseId: COMMUNITY,
      isFree: false,
    }));
    const taughtIds = lessonIdsTaughtToStudent({
      lessons: communityLessons,
      courses: [
        {
          id: COMMUNITY,
          name: "Kidda Community",
          requiredTier: "community",
          isPublic: true,
        },
      ],
      enrollments: [],
      cohortUnlocks: [],
      studentUnlockLessonIds: new Set(),
      adminPreviewCourseIds: new Set(),
    });
    assert.deepEqual(
      [...taughtIds].sort(),
      communityLessons.map((item) => item.id).sort()
    );
  });

  it("keeps a finished 1:1 package open and an active 1:1 filtered", () => {
    const lessonsInput = [
      { id: "lesson-1", courseId: BEGINNERS, isFree: false },
      { id: "lesson-2", courseId: BEGINNERS, isFree: false },
    ];
    const courses = [
      {
        id: BEGINNERS,
        name: "Beginners Course",
        requiredTier: "beginners",
        isPublic: true,
      },
    ];
    const finished = lessonIdsTaughtToStudent({
      lessons: lessonsInput,
      courses,
      enrollments: [
        {
          courseId: BEGINNERS,
          deliveryMode: "one_to_one",
          cohortId: null,
          individualPackageInactive: true,
        },
      ],
      cohortUnlocks: [],
      studentUnlockLessonIds: new Set(["lesson-1"]),
      adminPreviewCourseIds: new Set(),
    });
    assert.deepEqual([...finished].sort(), ["lesson-1", "lesson-2"]);

    const active = lessonIdsTaughtToStudent({
      lessons: lessonsInput,
      courses,
      enrollments: [
        {
          courseId: BEGINNERS,
          deliveryMode: "one_to_one",
          cohortId: null,
        },
      ],
      cohortUnlocks: [],
      studentUnlockLessonIds: new Set(["lesson-1"]),
      adminPreviewCourseIds: new Set(),
    });
    assert.deepEqual([...active], ["lesson-1"]);
  });
});

describe("extra practice and kid courses", () => {
  it("lists lesson-unlinked decks under extra practice after the weeks", () => {
    const weekLesson = lesson("lesson-1", 1, COMMUNITY);
    const summaries = buildGameDeckSummaries({
      lessons: [weekLesson],
      links: [
        { deckId: "week-deck", lessonId: weekLesson.id, courseId: COMMUNITY },
        { deckId: "master", lessonId: null, courseId: COMMUNITY },
        { deckId: "week-deck", lessonId: null, courseId: COMMUNITY },
      ],
      sets: [
        set("week-deck", "Vocabulary - Week 1", 1, 20),
        set("master", "Vocabulary - Master List", null, 1292),
      ],
      unlockedCourseIds: new Set([COMMUNITY]),
      taughtLessonIds: new Set([weekLesson.id]),
      englishCourseIds: null,
    });

    assert.deepEqual(
      summaries.map((deck) => [deck.weekNumber, deck.setName, deck.lessonTitle]),
      [
        [1, "Vocabulary - Week 1", "Lesson 1"],
        [null, "Vocabulary - Master List", "Extra practice"],
      ]
    );
    assert.equal(decksForWeek(summaries, 1).some((deck) => deck.deckId === "master"), false);
  });

  it("shows a kid's private course weeks and hides them from a parent session", () => {
    const kidsCourse = "kids-beginners";
    const kidsLesson: DeckListLesson = {
      ...lesson("kids-1", 1, kidsCourse),
      courseName: "Kids Beginners Course (Level 1)",
      courseTier: null,
      isPublicCourse: false,
    };
    const shared = {
      lessons: [kidsLesson],
      links: [{ deckId: "kids-vocab", lessonId: kidsLesson.id, courseId: kidsCourse }],
      sets: [set("kids-vocab", "Vocabulary - Week 1", 1, 12)],
      unlockedCourseIds: new Set([kidsCourse]),
      taughtLessonIds: new Set([kidsLesson.id]),
      englishCourseIds: null,
    };

    assert.equal(buildGameDeckSummaries(shared).length, 0);
    assert.equal(
      buildGameDeckSummaries({ ...shared, privateCourseIds: new Set([kidsCourse]) }).length,
      1
    );
  });
});
