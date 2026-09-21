export const PASSWORD_UPDATE_FALLBACK =
  "Something went wrong. Please try again.";

export const SAME_PASSWORD_MESSAGE =
  "Choose a password you haven't used before.";

export const PASSWORD_TOO_SHORT_MESSAGE =
  "Password must be at least 6 characters.";

export const PASSWORDS_DO_NOT_MATCH_MESSAGE = "Passwords do not match.";

export type NewPasswordValidation = {
  passwordError?: string;
  confirmError?: string;
};

export function validateNewPassword(
  password: string,
  confirmPassword: string
): NewPasswordValidation {
  if (password.length < 6) {
    return { passwordError: PASSWORD_TOO_SHORT_MESSAGE };
  }
  if (password !== confirmPassword) {
    return { confirmError: PASSWORDS_DO_NOT_MATCH_MESSAGE };
  }
  return {};
}

/** Always a string. Never String(error) — AuthError objects print as "{}". */
export function passwordUpdateErrorMessage(error: unknown): string {
  const { message, code } = extractAuthError(error);
  if (isSamePasswordError(code, message)) {
    return SAME_PASSWORD_MESSAGE;
  }
  return message || PASSWORD_UPDATE_FALLBACK;
}

function extractAuthError(error: unknown): { message: string; code: string } {
  if (!error || typeof error !== "object") {
    return { message: "", code: "" };
  }

  const record = error as { message?: unknown; code?: unknown };
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const code = typeof record.code === "string" ? record.code.trim() : "";
  return { message, code };
}

function isSamePasswordError(code: string, message: string): boolean {
  const lower = message.toLowerCase();
  return (
    code === "same_password" ||
    lower.includes("same password") ||
    lower.includes("should be different from the old") ||
    lower.includes("different from the old password")
  );
}
