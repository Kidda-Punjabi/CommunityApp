import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PASSWORD_TOO_SHORT_MESSAGE,
  PASSWORD_UPDATE_FALLBACK,
  PASSWORDS_DO_NOT_MATCH_MESSAGE,
  SAME_PASSWORD_MESSAGE,
  passwordUpdateErrorMessage,
  validateNewPassword,
} from "./password-update-error";

describe("validateNewPassword", () => {
  it("rejects passwords shorter than 6 characters", () => {
    assert.deepEqual(validateNewPassword("abcde", "abcde"), {
      passwordError: PASSWORD_TOO_SHORT_MESSAGE,
    });
  });

  it("rejects mismatched passwords", () => {
    assert.deepEqual(validateNewPassword("abcdef", "abcdefg"), {
      confirmError: PASSWORDS_DO_NOT_MATCH_MESSAGE,
    });
  });

  it("accepts matching passwords of at least 6 characters", () => {
    assert.deepEqual(validateNewPassword("abcdef", "abcdef"), {});
  });
});

describe("passwordUpdateErrorMessage", () => {
  it("maps same-password errors to the chosen copy", () => {
    assert.equal(
      passwordUpdateErrorMessage({
        code: "same_password",
        message: "New password should be different from the old password.",
      }),
      SAME_PASSWORD_MESSAGE
    );
  });

  it("returns error.message for reauthentication and other API errors", () => {
    assert.equal(
      passwordUpdateErrorMessage({
        code: "reauthentication_needed",
        message: "Reauthentication is required to change your password.",
      }),
      "Reauthentication is required to change your password."
    );
  });

  it("falls back when message is missing so the UI never renders {}", () => {
    assert.equal(passwordUpdateErrorMessage({}), PASSWORD_UPDATE_FALLBACK);
    assert.equal(passwordUpdateErrorMessage({ message: "" }), PASSWORD_UPDATE_FALLBACK);
    assert.equal(passwordUpdateErrorMessage(null), PASSWORD_UPDATE_FALLBACK);
  });
});
