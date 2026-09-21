const UNSAFE = /[\\/:\0<>|"*?]/g;

export function sanitizeIssueFilename(original: string, used: Set<string> = new Set()): string {
  const justName = original.replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = justName.replace(UNSAFE, "_").replace(/^\.+/g, "").trim() || "file";
  const capped = cleaned.slice(0, 180);
  const unique = uniquifyFilename(capped, used);
  used.add(unique.toLowerCase());
  return unique;
}

function uniquifyFilename(name: string, used: Set<string>): string {
  if (!used.has(name.toLowerCase())) return name;

  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let n = 2;
  let candidate = `${stem}-${n}${ext}`;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${stem}-${n}${ext}`;
  }
  return candidate;
}

export function extensionOf(name: string): string {
  const justName = name.replace(/\\/g, "/").split("/").pop() ?? "";
  const dot = justName.lastIndexOf(".");
  if (dot <= 0 || dot === justName.length - 1) return "";
  return justName.slice(dot + 1).toLowerCase();
}
