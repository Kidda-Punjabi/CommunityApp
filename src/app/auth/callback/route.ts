import { AUTH_RECOVERY_COOKIE } from "@/lib/auth/recovery-flow";
import { buildLastUserPayload, setLastUserOnResponse } from "@/lib/auth/remember-last-user";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth/safe-next-path";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    const dest = next === "/reset-password" ? "/reset-password" : "/login";
    return NextResponse.redirect(
      `${origin}${dest}?error_description=${encodeURIComponent(errorDescription)}`
    );
  }

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Heal profile ↔ Notion lead link after email confirmation (signup may have
      // linked already; createIfMissing stays true so brand-new app users still get a lead).
      const user = sessionData.session?.user ?? sessionData.user;
      const userEmail = user?.email?.trim();
      if (user?.id && userEmail) {
        try {
          const { createServiceRoleClient } = await import("@/lib/supabase/admin-server");
          const { linkLeadsForProfile } = await import("@/lib/notion/lead-sync");
          const service = createServiceRoleClient();
          const linkResult = await linkLeadsForProfile(service, user.id, userEmail, {
            fullName:
              typeof user.user_metadata?.full_name === "string"
                ? user.user_metadata.full_name
                : null,
          });
          const { maybeGrantAccessAfterLeadLink } = await import(
            "@/lib/notion/lead-purchase-access-grant"
          );
          await maybeGrantAccessAfterLeadLink(service, user.id, linkResult);
        } catch {
          // Best-effort — do not block auth redirect.
        }
      }

      const response = NextResponse.redirect(`${origin}${next}`);
      response.cookies.delete(AUTH_RECOVERY_COOKIE);

      const lastUser = await buildLastUserPayload(supabase);
      if (lastUser) setLastUserOnResponse(response, lastUser);

      return response;
    }

    if (next === "/reset-password") {
      return NextResponse.redirect(
        `${origin}/reset-password?error_description=${encodeURIComponent(error.message)}`
      );
    }
  }

  return NextResponse.redirect(
    `${origin}/login?message=${encodeURIComponent("Could not sign you in. Please try again.")}`
  );
}
