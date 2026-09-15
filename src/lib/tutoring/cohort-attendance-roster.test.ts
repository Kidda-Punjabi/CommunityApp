import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveCohortRosterActors } from "./cohort-attendance-roster";

const PARENT_MUNJALA = "parent-munjala";
const PARENT_AVLEEN = "parent-avleen";
const PARENT_HARMEET = "parent-harmeet";
const KID_GURVIR = "kid-gurvir";
const KID_AVLEEN = "kid-avleen";
const KID_AVANI = "kid-avani";
const KID_JYOTI = "kid-jyoti";
const KID_HARGUN = "kid-hargun";

const kidsByParentUserId = new Map<string, string[]>([
  [PARENT_MUNJALA, [KID_GURVIR]],
  [PARENT_AVLEEN, [KID_AVLEEN]],
  [PARENT_HARMEET, [KID_AVANI, KID_JYOTI]],
]);

describe("resolveCohortRosterActors", () => {
  it("lists only linked kids on a kids course, never parent accounts", () => {
    const result = resolveCohortRosterActors({
      isKidsCourse: true,
      members: [
        { userId: null, kidProfileId: KID_GURVIR, leftAt: null },
        { userId: null, kidProfileId: KID_AVLEEN, leftAt: null },
        { userId: null, kidProfileId: KID_AVANI, leftAt: null },
        { userId: null, kidProfileId: KID_JYOTI, leftAt: null },
        { userId: PARENT_AVLEEN, kidProfileId: null, leftAt: null },
        { userId: PARENT_MUNJALA, kidProfileId: null, leftAt: null },
        { userId: PARENT_HARMEET, kidProfileId: null, leftAt: null },
      ],
      enrollments: [
        { userId: PARENT_AVLEEN, kidProfileId: null },
        { userId: PARENT_MUNJALA, kidProfileId: null },
        { userId: PARENT_HARMEET, kidProfileId: null },
        { userId: null, kidProfileId: KID_GURVIR },
        { userId: null, kidProfileId: KID_AVLEEN },
        { userId: null, kidProfileId: KID_AVANI },
        { userId: null, kidProfileId: KID_JYOTI },
      ],
      kidsByParentUserId,
    });

    assert.deepEqual([...result.rosterUserIds].sort(), []);
    assert.deepEqual(
      [...result.rosterKidIds].sort(),
      [KID_AVANI, KID_AVLEEN, KID_GURVIR, KID_JYOTI].sort()
    );
    assert.equal(result.rosterKidIds.size, 4);
  });

  it("resolves a parent-only kids-course row to that parent's kids", () => {
    const result = resolveCohortRosterActors({
      isKidsCourse: true,
      members: [{ userId: PARENT_HARMEET, kidProfileId: null, leftAt: null }],
      enrollments: [{ userId: PARENT_HARMEET, kidProfileId: null }],
      kidsByParentUserId,
    });

    assert.deepEqual([...result.rosterUserIds], []);
    assert.deepEqual([...result.rosterKidIds].sort(), [KID_AVANI, KID_JYOTI].sort());
  });

  it("keeps left_at kids off a kids-course roster even if enrollments remain", () => {
    const result = resolveCohortRosterActors({
      isKidsCourse: true,
      members: [
        { userId: null, kidProfileId: KID_GURVIR, leftAt: null },
        { userId: null, kidProfileId: KID_HARGUN, leftAt: "2026-09-15T12:00:00.000Z" },
      ],
      enrollments: [
        { userId: null, kidProfileId: KID_GURVIR },
        { userId: null, kidProfileId: KID_HARGUN },
      ],
      extraActors: [{ userId: PARENT_MUNJALA, kidProfileId: null }],
      kidsByParentUserId,
    });

    assert.deepEqual([...result.rosterKidIds], [KID_GURVIR]);
    assert.equal(result.activeKidIds.has(KID_HARGUN), false);
  });

  it("still lists adult students on a non-kids course", () => {
    const result = resolveCohortRosterActors({
      isKidsCourse: false,
      members: [{ userId: PARENT_MUNJALA, kidProfileId: null, leftAt: null }],
      enrollments: [{ userId: PARENT_MUNJALA, kidProfileId: null }],
      kidsByParentUserId,
    });

    assert.deepEqual([...result.rosterUserIds], [PARENT_MUNJALA]);
    assert.deepEqual([...result.rosterKidIds], []);
  });
});
