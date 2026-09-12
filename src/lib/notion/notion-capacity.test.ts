import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COHORT_CAPACITY,
  cohortCapacityForInsert,
  cohortCapacitySyncPatch,
  readNotionCapacity,
} from "./notion-capacity";

describe("readNotionCapacity", () => {
  it("reads an explicit Notion number (kids / foundational group pages)", () => {
    assert.equal(
      readNotionCapacity({ Capacity: { id: "~F~t", type: "number", number: 4 } }),
      4
    );
  });

  it("treats a present-but-blank number as unset (adult Beginners pages)", () => {
    assert.equal(
      readNotionCapacity({ Capacity: { id: "~F~t", type: "number", number: null } }),
      null
    );
  });

  it("treats a missing Capacity key as unset (older package pages)", () => {
    assert.equal(readNotionCapacity({ "Package Name": { title: [] } }), null);
    assert.equal(readNotionCapacity({}), null);
    assert.equal(readNotionCapacity(null), null);
  });

  it("ignores zero and negative values", () => {
    assert.equal(readNotionCapacity({ Capacity: { type: "number", number: 0 } }), null);
    assert.equal(readNotionCapacity({ Capacity: { type: "number", number: -2 } }), null);
  });

  it("reads a formula number if the property is computed", () => {
    assert.equal(
      readNotionCapacity({ Capacity: { type: "formula", formula: { number: 6 } } }),
      6
    );
  });
});

describe("cohortCapacityForInsert", () => {
  it("uses Notion Capacity when set", () => {
    assert.equal(cohortCapacityForInsert({ Capacity: { type: "number", number: 4 } }), 4);
  });

  it("falls back to 7 when Capacity is blank or absent", () => {
    assert.equal(DEFAULT_COHORT_CAPACITY, 7);
    assert.equal(
      cohortCapacityForInsert({ Capacity: { type: "number", number: null } }),
      7
    );
    assert.equal(cohortCapacityForInsert({}), 7);
  });
});

describe("cohortCapacitySyncPatch", () => {
  it("writes capacity only when Notion has an explicit value", () => {
    assert.deepEqual(cohortCapacitySyncPatch({ Capacity: { type: "number", number: 4 } }), {
      capacity: 4,
    });
    assert.deepEqual(
      cohortCapacitySyncPatch({ Capacity: { type: "number", number: null } }),
      {}
    );
    assert.deepEqual(cohortCapacitySyncPatch({}), {});
  });
});
