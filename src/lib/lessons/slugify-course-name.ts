/** Stable storage path segment from a course display name, e.g. "Foundational Course" → "foundational-course". */
export function slugifyCourseName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "course";
}
