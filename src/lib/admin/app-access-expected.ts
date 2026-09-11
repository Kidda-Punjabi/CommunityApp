/**
 * `package_instances.app_access_expected` defaults to true.
 * Only an explicit false means the student was backlogged without an app account.
 */
export function isAppAccessExpected(value: boolean | null | undefined): boolean {
  return value !== false;
}

/** Incomplete package onboarding rows stay on the ops list unless their instance is flagged false. */
export function includeIncompleteChecklistForAppAccess(input: {
  packageInstanceId: string | null | undefined;
  instanceAppAccessExpected: boolean | null | undefined;
}): boolean {
  if (!input.packageInstanceId) return true;
  return isAppAccessExpected(input.instanceAppAccessExpected);
}
