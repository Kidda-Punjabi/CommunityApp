import { cookies } from "next/headers";

/** Session cookie: Learn English mode on for this browser session only. */
export const LEARN_ENGLISH_MODE_COOKIE = "learn_english_mode";

export async function isLearnEnglishModeEnabled(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(LEARN_ENGLISH_MODE_COOKIE)?.value === "1";
}

export function learnEnglishModeCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    // Session cookie — cleared when the browser session ends.
  };
}
