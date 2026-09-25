import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideParentEntry } from "./parent-entry";

const base = {
  pickedWhoThisSession: false,
  activeKidProfileId: null as string | null,
  viewAsActive: false,
};

describe("decideParentEntry", () => {
  it("opens the only kid when the parent has no adult course", () => {
    assert.equal(
      decideParentEntry({ ...base, kidCount: 1, hasOwnAdultCourse: false }),
      "enter-kid"
    );
  });

  it("shows the picker when several kids and no adult course", () => {
    assert.equal(
      decideParentEntry({ ...base, kidCount: 2, hasOwnAdultCourse: false }),
      "picker"
    );
  });

  it("does not auto-enter a parent who also has an adult course", () => {
    assert.equal(
      decideParentEntry({ ...base, kidCount: 1, hasOwnAdultCourse: true }),
      "stay"
    );
    assert.equal(
      decideParentEntry({ ...base, kidCount: 4, hasOwnAdultCourse: true }),
      "stay"
    );
  });

  it("stays put after this browser session already chose a profile", () => {
    assert.equal(
      decideParentEntry({
        ...base,
        kidCount: 1,
        hasOwnAdultCourse: false,
        pickedWhoThisSession: true,
      }),
      "stay"
    );
  });

  it("leaves adult learners with no kid profiles on the parent home", () => {
    assert.equal(
      decideParentEntry({ ...base, kidCount: 0, hasOwnAdultCourse: true }),
      "stay"
    );
    assert.equal(
      decideParentEntry({ ...base, kidCount: 0, hasOwnAdultCourse: false }),
      "stay"
    );
  });
});
