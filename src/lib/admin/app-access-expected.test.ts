import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  includeIncompleteChecklistForAppAccess,
  isAppAccessExpected,
} from "./app-access-expected";

describe("isAppAccessExpected", () => {
  it("treats true, null, and undefined as expected", () => {
    assert.equal(isAppAccessExpected(true), true);
    assert.equal(isAppAccessExpected(null), true);
    assert.equal(isAppAccessExpected(undefined), true);
  });

  it("treats false as not expected", () => {
    assert.equal(isAppAccessExpected(false), false);
  });
});

describe("includeIncompleteChecklistForAppAccess", () => {
  it("keeps cohort checklists with no package instance", () => {
    assert.equal(
      includeIncompleteChecklistForAppAccess({
        packageInstanceId: null,
        instanceAppAccessExpected: false,
      }),
      true
    );
  });

  it("keeps instance checklists unless the linked instance is false", () => {
    assert.equal(
      includeIncompleteChecklistForAppAccess({
        packageInstanceId: "pi-1",
        instanceAppAccessExpected: true,
      }),
      true
    );
    assert.equal(
      includeIncompleteChecklistForAppAccess({
        packageInstanceId: "pi-1",
        instanceAppAccessExpected: null,
      }),
      true
    );
    assert.equal(
      includeIncompleteChecklistForAppAccess({
        packageInstanceId: "pi-1",
        instanceAppAccessExpected: false,
      }),
      false
    );
  });
});
