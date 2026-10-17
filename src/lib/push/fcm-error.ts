/** FCM HTTP v1 marks a dead device token as UNREGISTERED, often with HTTP 404. */
export function fcmUnregistered(status: number, body: string): boolean {
  if (status === 404) return true;
  try {
    const parsed = JSON.parse(body) as {
      error?: { status?: string; details?: Array<{ errorCode?: string }> };
    };
    const code = parsed.error?.status;
    if (code === "UNREGISTERED" || code === "NOT_FOUND") return true;
    return (parsed.error?.details ?? []).some((detail) => detail.errorCode === "UNREGISTERED");
  } catch {
    return false;
  }
}
