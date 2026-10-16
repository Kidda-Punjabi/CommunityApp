import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountDeletionBlockedReason, normalizeDeleteConfirmation } from "./deletion-policy";

describe("account deletion policy", () => {
  it("requires the word DELETE", () => {
    assert.equal(normalizeDeleteConfirmation("delete"), false);
    assert.equal(normalizeDeleteConfirmation(" DELETE "), true);
  });

  it("blocks tutor and admin roles", () => {
    assert.equal(accountDeletionBlockedReason(["member"], false), null);
    assert.match(accountDeletionBlockedReason(["tutor"], false) ?? "", /can't be deleted/);
    assert.match(accountDeletionBlockedReason(["member"], true) ?? "", /can't be deleted/);
    assert.match(accountDeletionBlockedReason(["master_admin"], false) ?? "", /can't be deleted/);
  });
});
