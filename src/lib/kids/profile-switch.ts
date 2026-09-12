/**
 * PIN is required only when leaving a kid profile for the parent account.
 * Parent → kid and kid → kid are not gated.
 */
export function requiresPinForProfileSwitch(args: {
  fromKidProfileId: string | null;
  toKidProfileId: string | null;
}): boolean {
  return args.fromKidProfileId !== null && args.toKidProfileId === null;
}
