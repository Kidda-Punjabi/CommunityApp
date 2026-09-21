import { ISSUE_ERROR_FALLBACK } from "@/lib/issues/types";

/** Always a string. Never render a raw error object (those print as "{}"). */
export function issueErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    const trimmed = error.trim();
    return trimmed || ISSUE_ERROR_FALLBACK;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return ISSUE_ERROR_FALLBACK;
}
