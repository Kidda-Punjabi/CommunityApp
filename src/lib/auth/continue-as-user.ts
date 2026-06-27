import { parseLastUser, LAST_USER_COOKIE } from "@/lib/auth/last-user";
import { buildLastUserPayload } from "@/lib/auth/remember-last-user";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export type ContinueAsUser = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  sessionActive: boolean;
};

export async function getContinueAsUser(): Promise<ContinueAsUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.email) {
    const payload = await buildLastUserPayload(supabase);
    if (payload) {
      return { ...payload, sessionActive: true };
    }

    return {
      email: user.email,
      displayName: user.email.split("@")[0],
      avatarUrl: null,
      sessionActive: true,
    };
  }

  const cookieStore = await cookies();
  const remembered = parseLastUser(cookieStore.get(LAST_USER_COOKIE)?.value);
  if (!remembered) return null;

  return { ...remembered, sessionActive: false };
}
