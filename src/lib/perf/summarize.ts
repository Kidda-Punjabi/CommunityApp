import type { PerfSpan } from "@/lib/perf/types";

export type CallTarget = {
  kind: "supabase" | "external";
  name: string;
  op: string;
};

const EXTERNAL_HOSTS: Array<[string, string]> = [
  ["notion.com", "notion"],
  ["notion.so", "notion"],
  ["stripe.com", "stripe"],
  ["googleapis.com", "google"],
  ["google.com", "google"],
  ["elevenlabs.io", "elevenlabs"],
  ["apple.com", "apns"],
];

export function describeCall(url: URL, method: string): CallTarget | null {
  const host = url.hostname.toLowerCase();
  const verb = method.toUpperCase();

  if (host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) {
    if (url.pathname.startsWith("/storage/v1/")) {
      return { kind: "external", name: "storage", op: verb.toLowerCase() };
    }
    if (url.pathname.startsWith("/auth/v1/")) {
      const part = url.pathname.split("/").filter(Boolean).slice(2).join("/") || "auth";
      return { kind: "supabase", name: "auth", op: part };
    }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const name = decodeURIComponent(url.pathname.split("/").pop() || "rpc");
      return { kind: "supabase", name, op: "rpc" };
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      const table = decodeURIComponent(url.pathname.slice("/rest/v1/".length).split("/")[0] || "rest");
      const op = verb === "GET" || verb === "HEAD" ? "select" : verb === "POST" ? "insert" : verb === "PATCH" ? "update" : verb === "DELETE" ? "delete" : verb.toLowerCase();
      return { kind: "supabase", name: table, op };
    }
    return { kind: "supabase", name: "supabase", op: verb.toLowerCase() };
  }

  for (const [needle, name] of EXTERNAL_HOSTS) {
    if (host === needle || host.endsWith(`.${needle}`)) {
      return { kind: "external", name, op: verb.toLowerCase() };
    }
  }
  return null;
}

export function contentRangeRows(header: string | null): number | null {
  if (!header) return null;
  const total = header.split("/")[1];
  if (!total || total === "*") return null;
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sequentialChain(spans: PerfSpan[]): { depth: number; ms: number } {
  if (spans.length === 0) return { depth: 0, ms: 0 };
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const depth = sorted.map(() => 1);
  const time = sorted.map((span) => span.ms);
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      if (sorted[j].end > sorted[i].start + 1) continue;
      const nextDepth = depth[j] + 1;
      const nextTime = time[j] + sorted[i].ms;
      if (nextDepth > depth[i] || (nextDepth === depth[i] && nextTime > time[i])) {
        depth[i] = nextDepth;
        time[i] = nextTime;
      }
    }
  }
  let best = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    if (depth[i] > depth[best] || (depth[i] === depth[best] && time[i] > time[best])) best = i;
  }
  return { depth: depth[best], ms: Math.round(time[best]) };
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

export function formatServerTiming(input: {
  totalMs: number;
  middlewareMs: number;
  queryCount: number;
  sequentialDepth: number;
  spans: PerfSpan[];
}): string {
  const dbMs = Math.round(input.spans.filter((span) => span.kind === "supabase").reduce((sum, span) => sum + span.ms, 0));
  const parts = [
    `total;dur=${input.totalMs}`,
    `mw;dur=${input.middlewareMs}`,
    `db;dur=${dbMs}`,
    `dbcount;desc="${input.queryCount}"`,
    `seq;desc="${input.sequentialDepth}"`,
  ];
  const seen = new Map<string, number>();
  for (const span of [...input.spans].sort((a, b) => b.ms - a.ms).slice(0, 8)) {
    const base = `${span.name}_${span.op}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 36) || "call";
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    parts.push(`${count === 1 ? base : `${base}_${count}`};dur=${Math.round(span.ms)}`);
  }
  return parts.join(", ");
}
