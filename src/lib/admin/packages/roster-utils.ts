export function isPersistedStudentPackageId(id: string): boolean {
  return !id.startsWith("notion-roster:") && !id.startsWith("inbox-cache:");
}
