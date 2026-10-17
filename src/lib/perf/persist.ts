import "server-only";

import { forgetTrace } from "@/lib/perf/context";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { sequentialChain, formatServerTiming } from "@/lib/perf/summarize";
import type { PerfSpan, PerfTrace } from "@/lib/perf/types";

export type PerfSummary = {
  route: string;
  method: string;
  persona: string;
  prefetch: boolean;
  totalMs: number;
  middlewareMs: number;
  queryCount: number;
  sequentialDepth: number;
  sequentialMs: number;
  parallelCount: number;
  responseBytes: number | null;
  slowest: Array<{ name: string; op: string; ms: number; rows: number | null; parallel: boolean }>;
  spans: PerfSpan[];
};

function withMiddleware(trace: PerfTrace): PerfSpan[] {
  const spans = trace.spans.map((span) => ({ ...span }));
  if (!trace.sawMiddleware) return spans;
  if (spans.some((span) => span.op === "middleware")) return spans;
  for (const span of spans) {
    span.start += trace.middlewareMs;
    span.end += trace.middlewareMs;
  }
  spans.unshift({
    kind: "supabase",
    name: "auth",
    op: "middleware",
    ms: trace.middlewareMs,
    rows: null,
    bytes: null,
    start: 0,
    end: trace.middlewareMs,
    parallel: false,
  });
  return spans;
}

function markParallel(spans: PerfSpan[]) {
  for (const span of spans) {
    span.parallel = spans.some(
      (other) => other !== span && other.start < span.end && other.end > span.start
    );
  }
}

export function summarizeTrace(trace: PerfTrace, finishedAt = performance.now()): PerfSummary {
  const spans = withMiddleware(trace);
  markParallel(spans);
  const chain = sequentialChain(spans);
  const queries = spans.filter((span) => span.kind === "supabase");
  const totalMs = trace.middlewareMs + Math.max(0, Math.round(finishedAt - trace.started));
  const slowest = [...spans]
    .sort((a, b) => b.ms - a.ms)
    .slice(0, 5)
    .map((span) => ({
      name: span.name,
      op: span.op,
      ms: span.ms,
      rows: span.rows,
      parallel: span.parallel,
    }));
  const responseBytes = spans.reduce((sum, span) => sum + (span.bytes ?? 0), 0);
  return {
    route: trace.route || "unknown",
    method: trace.method || "GET",
    persona: trace.persona,
    prefetch: trace.prefetch,
    totalMs,
    middlewareMs: trace.middlewareMs,
    queryCount: queries.length,
    sequentialDepth: chain.depth,
    sequentialMs: chain.ms,
    parallelCount: spans.filter((span) => span.parallel).length,
    responseBytes: responseBytes || null,
    slowest,
    spans,
  };
}

export function serverTimingHeader(summary: PerfSummary): string {
  return formatServerTiming({
    totalMs: summary.totalMs,
    middlewareMs: summary.middlewareMs,
    queryCount: summary.queryCount,
    sequentialDepth: summary.sequentialDepth,
    spans: summary.spans,
  });
}

export async function persistTrace(trace: PerfTrace): Promise<void> {
  if (trace.persisted) return;
  trace.persisted = true;
  trace.sealed = true;
  forgetTrace(trace.id);
  await Promise.race([
    Promise.all(trace.pending),
    new Promise((resolve) => setTimeout(resolve, 400)),
  ]);
  const summary = summarizeTrace(trace);
  if (
    !summary.route ||
    summary.route.startsWith("/_next") ||
    summary.route.startsWith("/__next") ||
    summary.route === "/favicon.ico" ||
    (summary.queryCount === 0 && !trace.sawMiddleware)
  ) {
    return;
  }
  const line = {
    perf: true,
    route: summary.route,
    method: summary.method,
    persona: summary.persona || null,
    prefetch: summary.prefetch,
    total_ms: summary.totalMs,
    middleware_ms: summary.middlewareMs,
    query_count: summary.queryCount,
    sequential_depth: summary.sequentialDepth,
    sequential_ms: summary.sequentialMs,
    parallel_count: summary.parallelCount,
    slowest: summary.slowest,
  };
  console.log(JSON.stringify(line));
  try {
    const admin = createServiceRoleClient();
    await admin.from("perf_traces").insert({
      route: summary.route,
      method: summary.method,
      persona: summary.persona || null,
      prefetch: summary.prefetch,
      total_ms: summary.totalMs,
      middleware_ms: summary.middlewareMs,
      query_count: summary.queryCount,
      sequential_depth: summary.sequentialDepth,
      sequential_ms: summary.sequentialMs,
      parallel_count: summary.parallelCount,
      response_bytes: summary.responseBytes,
      slowest: summary.slowest,
      spans: summary.spans,
    });
    if (Math.random() < 0.05) {
      await admin
        .from("perf_traces")
        .delete()
        .lt("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
    }
  } catch (error) {
    console.log(
      JSON.stringify({
        perf: true,
        persist_error: error instanceof Error ? error.message : "insert failed",
        route: summary.route,
      })
    );
  }
}
