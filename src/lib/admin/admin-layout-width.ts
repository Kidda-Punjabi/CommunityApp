/**
 * Shared admin content width — expands with the viewport instead of capping at
 * phone-width max-w-lg. Horizontal padding stays on header/nav/page shells so
 * we do not double-pad.
 */
export function getAdminContainerClass(_pathname: string): string {
  return "mx-auto w-full max-w-none";
}
