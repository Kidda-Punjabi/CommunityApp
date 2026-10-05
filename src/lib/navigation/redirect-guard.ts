/**
 * Stop a navigation from redirecting to the route it is already on,
 * or from issuing a second redirect in the same navigation.
 * Returns the destination to use, or null when the redirect must not happen.
 */
export function planRedirect(input: {
  currentPath: string;
  destination: string;
  redirectsAlreadyIssued: number;
}): string | null {
  if (input.redirectsAlreadyIssued >= 1) return null;
  const current = normalizePath(input.currentPath);
  const destination = normalizePath(input.destination);
  if (!current || current === destination) return null;
  return destination;
}

function normalizePath(path: string): string {
  const withoutQuery = path.split("?")[0]?.split("#")[0] ?? "";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
}
