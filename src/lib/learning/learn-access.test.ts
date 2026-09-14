import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessLessonInContext } from "./learn-access";
import type { CourseAccessContext } from "@/lib/membership/unlocked";

const ADULT_BEGINNERS = "155d5df5-c442-4e95-a908-2a16fa2e8c8d";
const KIDS_BEGINNERS = "9db3685b-15fe-41a3-b902-1c2db3000b33";
const FOUNDATIONAL = "foundational-course-id";

const courses = [
  {
    id: ADULT_BEGINNERS,
    name: "Beginners Course",
    required_tier: "beginners",
    is_public: true,
  },
  {
    id: KIDS_BEGINNERS,
    name: "Kids Beginners Course",
    required_tier: "private",
    is_public: true,
  },
  {
    id: FOUNDATIONAL,
    name: "Foundational Course",
    required_tier: "foundational",
    is_public: true,
  },
];

function access(unlocked: string[]): CourseAccessContext {
  return {
    unlockedCourseIds: new Set(unlocked),
    courses,
    isFreeOnly: unlocked.length === 0,
    viewAs: null,
  };
}

describe("canAccessLessonInContext", () => {
  it("unlocks adult Beginners from the adult course grant", () => {
    assert.equal(
      canAccessLessonInContext(access([ADULT_BEGINNERS]), {
        is_free: false,
        course_id: ADULT_BEGINNERS,
      }),
      true
    );
  });

  it("does not treat adult Beginners membership as Kids Beginners access", () => {
    assert.equal(
      canAccessLessonInContext(access([ADULT_BEGINNERS]), {
        is_free: false,
        course_id: KIDS_BEGINNERS,
      }),
      false
    );
  });

  it("unlocks Kids Beginners from that course's own grant", () => {
    assert.equal(
      canAccessLessonInContext(access([KIDS_BEGINNERS]), {
        is_free: false,
        course_id: KIDS_BEGINNERS,
      }),
      true
    );
  });

  it("does not map private kids courses onto Foundational membership", () => {
    assert.equal(
      canAccessLessonInContext(access([FOUNDATIONAL]), {
        is_free: false,
        course_id: KIDS_BEGINNERS,
      }),
      false
    );
  });
});
