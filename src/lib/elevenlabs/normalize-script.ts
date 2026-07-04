export type ScriptNormalizationReport = {
  normalized: string;
  changed: boolean;
  issues: string[];
  codepoints: number[];
};

/**
 * Normalize Gurmukhi script before TTS — catches invisible Unicode differences
 * that can change pronunciation without being obvious on screen.
 */
export function normalizeScriptText(text: string): ScriptNormalizationReport {
  const issues: string[] = [];
  const original = text;

  let normalized = original.normalize("NFC");

  if (normalized !== original) {
    issues.push("Unicode normalization (NFC) changed the text — possible composed vs decomposed characters.");
  }

  const withoutBom = normalized.replace(/^\uFEFF/, "");
  if (withoutBom !== normalized) {
    issues.push("Removed UTF-8 BOM from start of text.");
    normalized = withoutBom;
  }

  normalized = normalized.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const collapsed = normalized.replace(/[ \t\f\v\u00A0]+/g, " ");
  if (collapsed !== normalized) {
    issues.push("Collapsed irregular whitespace.");
    normalized = collapsed;
  }

  normalized = normalized.replace(/\n{3,}/g, "\n\n");

  normalized = normalized.trim();

  if (/[\u200B-\u200D\uFEFF]/.test(normalized)) {
    issues.push("Contains zero-width or invisible Unicode characters — review source text.");
  }

  const codepoints = [...normalized].map((char) => char.codePointAt(0) ?? 0);

  return {
    normalized,
    changed: normalized !== original.trim(),
    issues,
    codepoints,
  };
}

export function formatCodepointInspection(text: string): string {
  return [...text]
    .map((char) => {
      const cp = char.codePointAt(0) ?? 0;
      return `${char} U+${cp.toString(16).toUpperCase().padStart(4, "0")}`;
    })
    .join("\n");
}
