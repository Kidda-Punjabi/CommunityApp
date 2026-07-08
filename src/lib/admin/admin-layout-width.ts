/** Admin content max-width — packages and onboarding expand on larger screens. */
export function getAdminContainerClass(pathname: string): string {
  if (
    pathname.startsWith("/admin/packages") ||
    pathname.startsWith("/admin/sales-calls") ||
    pathname.startsWith("/admin/onboarding") ||
    pathname.startsWith("/admin/content/calendar")
  ) {
    return "mx-auto w-full max-w-lg sm:max-w-3xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[88rem]";
  }

  return "mx-auto w-full max-w-lg";
}
