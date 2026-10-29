/**
 * Capitalise the first letter of each part of a person's name for certificates:
 * "harpreet kaur" -> "Harpreet Kaur", "jean-luc o'neill" -> "Jean-Luc O'Neill".
 * Only ever raises a first letter; never lowercases the rest, so "McDonald"
 * and "DeSouza" stay exactly as typed. Non-Latin scripts pass through unchanged.
 */
export function properName(raw: string | null | undefined): string {
  const text = (raw ?? "").trim().replace(/\s+/g, " ");
  return text.replace(/(^|[\s\-'’])(\p{Ll})/gu, (_match, before: string, letter: string) =>
    `${before}${letter.toLocaleUpperCase("en-GB")}`
  );
}
