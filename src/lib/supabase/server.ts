import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { verifiedUserFromCookies } from "@/lib/supabase/local-session";

async function createRawClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore if middleware
            // refreshes the session.
          }
        },
      },
    }
  );
}

const cachedAuthUser = cache(async () => {
  const cookieStore = await cookies();
  const local = await verifiedUserFromCookies(cookieStore);
  if (local.user && !local.refresh) {
    return { data: { user: local.user }, error: null };
  }
  const supabase = await createRawClient();
  return supabase.auth.getUser();
});

export async function createClient() {
  const supabase = await createRawClient();
  const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
  supabase.auth.getUser = ((jwt?: string) => {
    if (jwt) return originalGetUser(jwt);
    return cachedAuthUser();
  }) as typeof supabase.auth.getUser;
  return supabase;
}
