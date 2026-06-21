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

  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
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

  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = POST_AUTH_PATH;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
