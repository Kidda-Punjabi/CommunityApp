import { safeNextPath } from "@/lib/auth/safe-next-path";
import {
  AUTH_RECOVERY_COOKIE,
  authCallbackNextPath,
  buildAuthCallbackUrl,
} from "@/lib/auth/recovery-flow";
import {
  lastUserCookieOptions,
  lastUserFromAuthMetadata,
  LAST_USER_COOKIE,
  parseLastUser,
  serializeLastUser,
} from "@/lib/auth/last-user";
import {
  normalizeReferralCode,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
} from "@/lib/referrals/constants";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const POST_AUTH_PATH = "/dashboard/home";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const referralCode = normalizeReferralCode(request.nextUrl.searchParams.get("ref"));

  function withReferralCookie(response: NextResponse) {
    if (!referralCode) return response;
    response.cookies.set(REFERRAL_COOKIE_NAME, referralCode, {
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return response;
  }

  if (referralCode && request.nextUrl.pathname !== "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.searchParams.set("ref", referralCode);
    return withReferralCookie(NextResponse.redirect(url));
  }

  if (referralCode && request.nextUrl.pathname === "/signup") {
    supabaseResponse = withReferralCookie(supabaseResponse);
  }

  // Email confirm / OAuth codes may still land on legacy `/dashboard` Site URL.
  if (request.nextUrl.pathname === "/dashboard") {
    const code = request.nextUrl.searchParams.get("code");
    if (code) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/callback";
      url.searchParams.set("next", POST_AUTH_PATH);
      return NextResponse.redirect(url);
    }
  }

  // Recovery / confirm links may land on Site URL (`/`) when redirect URLs are misconfigured.
  if (request.nextUrl.pathname === "/") {
    const code = request.nextUrl.searchParams.get("code");
    const errorDescription = request.nextUrl.searchParams.get("error_description");
    const type = request.nextUrl.searchParams.get("type");
    const hasRecoveryCookie =
      request.cookies.get(AUTH_RECOVERY_COOKIE)?.value === "1";

    if (code) {
      const next = authCallbackNextPath(type, hasRecoveryCookie);
      const redirectUrl = new URL(buildAuthCallbackUrl(request.nextUrl.origin, code, next));
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete(AUTH_RECOVERY_COOKIE);
      return response;
    }

    if (errorDescription) {
      const url = request.nextUrl.clone();
      url.pathname =
        authCallbackNextPath(type, hasRecoveryCookie) === "/reset-password"
          ? "/reset-password"
          : "/login";
      return NextResponse.redirect(url);
    }
  }

  if (request.nextUrl.pathname === "/reset-password") {
    const code = request.nextUrl.searchParams.get("code");
    if (code) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/callback";
      url.searchParams.set("next", "/reset-password");
      return NextResponse.redirect(url);
    }
  }

  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (
    user &&
    (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = safeNextPath(request.nextUrl.searchParams.get("next"));
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname === "/dashboard") {
    const url = request.nextUrl.clone();
    url.pathname = POST_AUTH_PATH;
    return NextResponse.redirect(url);
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  if (user?.email) {
    const remembered = lastUserFromAuthMetadata(user);
    if (remembered) {
      const existing = parseLastUser(request.cookies.get(LAST_USER_COOKIE)?.value);
      if (!existing || existing.email !== remembered.email) {
        supabaseResponse.cookies.set(
          LAST_USER_COOKIE,
          serializeLastUser(remembered),
          lastUserCookieOptions()
        );
      }
    }
  }

  return supabaseResponse;
}
