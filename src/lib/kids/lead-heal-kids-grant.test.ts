import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickLeadHealKidProfile } from "./lead-heal-kids-grant-logic";

const meher = { id: "meher", name: "Meher" };
const kabir = { id: "kabir", name: "Kabir" };

describe("pickLeadHealKidProfile", () => {
  it("waits when the parent has no kid profile", () => {
    assert.deepEqual(pickLeadHealKidProfile([], {}), { status: "wait" });
  });

  it("grants to the only kid profile", () => {
    assert.deepEqual(pickLeadHealKidProfile([meher], {}), {
      status: "grant",
      kidProfileId: "meher",
    });
  });

  it("stays unresolved when several profiles have no name or id", () => {
    assert.deepEqual(pickLeadHealKidProfile([meher, kabir], {}), { status: "ambiguous" });
  });

  it("uses an explicit profile id even when several kids exist", () => {
    assert.deepEqual(
      pickLeadHealKidProfile([meher, kabir], { kidProfileId: "kabir" }),
      { status: "grant", kidProfileId: "kabir" }
    );
  });

  it("matches a single kid by name", () => {
    assert.deepEqual(
      pickLeadHealKidProfile([meher, kabir], { kidName: " meher " }),
      { status: "grant", kidProfileId: "meher" }
    );
  });

  it("does not assign a named child to a different only profile", () => {
    assert.deepEqual(pickLeadHealKidProfile([meher], { kidName: "Kabir" }), {
      status: "ambiguous",
    });
  });
});
