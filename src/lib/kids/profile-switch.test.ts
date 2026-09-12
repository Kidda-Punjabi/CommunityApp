import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { requiresPinForProfileSwitch } from "./profile-switch";
import { usesKidsShell } from "./constants";

describe("requiresPinForProfileSwitch", () => {
  it("requires a PIN only when switching from a kid profile to the parent account", () => {
    assert.equal(
      requiresPinForProfileSwitch({
        fromKidProfileId: "kid-a",
        toKidProfileId: null,
      }),
      true
    );
  });

  it("does not require a PIN when switching from the parent account to a kid", () => {
    assert.equal(
      requiresPinForProfileSwitch({
        fromKidProfileId: null,
        toKidProfileId: "kid-a",
      }),
      false
    );
  });

  it("does not require a PIN when switching from one kid profile to another", () => {
    assert.equal(
      requiresPinForProfileSwitch({
        fromKidProfileId: "kid-a",
        toKidProfileId: "kid-b",
      }),
      false
    );
  });

  it("does not require a PIN when tapping the already-active parent account", () => {
    assert.equal(
      requiresPinForProfileSwitch({
        fromKidProfileId: null,
        toKidProfileId: null,
      }),
      false
    );
  });
});

describe("usesKidsShell", () => {
  it("uses the kids shell for Kids (6 & under) and legacy 6-and-under slugs", () => {
    assert.equal(usesKidsShell("kids"), true);
    assert.equal(usesKidsShell("little_ones"), true);
    assert.equal(usesKidsShell("pre_reader"), true);
  });

  it("does not use the kids shell for Juniors, Preteens, Teens, or legacy older slugs", () => {
    assert.equal(usesKidsShell("juniors"), false);
    assert.equal(usesKidsShell("preteens"), false);
    assert.equal(usesKidsShell("teens"), false);
    assert.equal(usesKidsShell("early_reader"), false);
    assert.equal(usesKidsShell("pre_teen"), false);
    assert.equal(usesKidsShell("independent"), false);
  });
});
