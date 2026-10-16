const PURCHASE_PREFIXES = [
  "/checkout",
  "/dashboard/membership",
  "/book-call",
  "/courses",
  "/how-it-works",
  "/dashboard/profile/billing",
];

export function isSignupPath(pathname: string): boolean {
  return pathname === "/signup" || pathname.startsWith("/signup/");
}

export function isNativePurchasePath(pathname: string): boolean {
  if (isSignupPath(pathname)) return true;
  return PURCHASE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Where the iOS app should send a purchase or signup URL. */
export function nativePurchaseRedirect(pathname: string): "/login" | "/dashboard" | null {
  if (!isNativePurchasePath(pathname)) return null;
  if (isSignupPath(pathname)) return "/login";
  return "/dashboard";
}
