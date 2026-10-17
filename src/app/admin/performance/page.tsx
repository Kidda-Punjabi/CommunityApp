import { percentile } from "@/lib/perf/summarize";
import type { PerfSpan } from "@/lib/perf/types";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type TraceRow = {
  id: string;
  created_at: string;
  route: string;
  total_ms: number;
  query_count: number;
  sequential_depth: number;
  sequential_ms: number;
  middleware_ms: number;
  prefetch: boolean;
  persona: string | null;
  response_bytes: number | null;
  client_js_bytes: number | null;
  slowest: Array<{ name: string; op: string; ms: number; parallel: boolean }> | null;
  spans?: PerfSpan[] | null;
};

type RouteStat = {
  route: string;
  count: number;
  p50: number;
  p95: number;
  queries: number;
  depth: number;
  slowest: Array<{ name: string; op: string; ms: number }>;
  responseBytes: number | null;
  jsBytes: number | null;
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildStats(rows: TraceRow[]): RouteStat[] {
  const grouped = new Map<string, TraceRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.route) ?? [];
    list.push(row);
    grouped.set(row.route, list);
  }
  return [...grouped.entries()]
    .map(([route, list]) => {
      const calls = new Map<string, { name: string; op: string; ms: number }>();
      for (const row of list) {
        for (const call of row.slowest ?? []) {
          const key = `${call.name}:${call.op}`;
          const existing = calls.get(key);
          if (!existing || call.ms > existing.ms) calls.set(key, { name: call.name, op: call.op, ms: call.ms });
        }
      }
      const bytes = list.map((row) => row.response_bytes).filter((value): value is number => value != null);
      const js = list.map((row) => row.client_js_bytes).filter((value): value is number => value != null);
      return {
        route,
        count: list.length,
        p50: percentile(list.map((row) => row.total_ms), 50),
        p95: percentile(list.map((row) => row.total_ms), 95),
        queries: average(list.map((row) => row.query_count)),
        depth: average(list.map((row) => row.sequential_depth)),
        slowest: [...calls.values()].sort((a, b) => b.ms - a.ms).slice(0, 5),
        responseBytes: bytes.length ? average(bytes) : null,
        jsBytes: js.length ? average(js) : null,
      };
    })
    .sort((a, b) => b.p95 - a.p95);
}

function kb(bytes: number | null): string {
  if (bytes == null) return "—";
  return `${Math.round(bytes / 1024)} KB`;
}

function hrefFor(route: string, traceId?: string, includePrefetch = false): string {
  const params = new URLSearchParams({ route });
  if (traceId) params.set("trace", traceId);
  if (includePrefetch) params.set("prefetch", "1");
  return `/admin/performance?${params.toString()}`;
}

export default async function AdminPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ prefetch?: string; persona?: string; route?: string; trace?: string }>;
}) {
  const params = await searchParams;
  const includePrefetch = params.prefetch === "1";
  const admin = createServiceRoleClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let query = admin
    .from("perf_traces")
    .select("id, created_at, route, total_ms, query_count, sequential_depth, sequential_ms, middleware_ms, prefetch, persona, response_bytes, client_js_bytes, slowest")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(4000);
  if (!includePrefetch) query = query.eq("prefetch", false);
  if (params.persona) query = query.eq("persona", params.persona);
  const { data, error } = await query;
  const rows = (data ?? []) as TraceRow[];
  const stats = error ? [] : buildStats(rows);

  let waterfall: TraceRow | null = null;
  let routeTraces: TraceRow[] = [];
  if (params.route && !error) {
    routeTraces = rows.filter((row) => row.route === params.route).slice(0, 20);
    const selectedId = params.trace || routeTraces[0]?.id;
    if (selectedId) {
      const { data: detail } = await admin
        .from("perf_traces")
        .select("id, created_at, route, total_ms, query_count, sequential_depth, sequential_ms, middleware_ms, prefetch, persona, response_bytes, client_js_bytes, slowest, spans")
        .eq("id", selectedId)
        .maybeSingle();
      waterfall = (detail as TraceRow | null) ?? null;
    }
  }
  const spans = waterfall?.spans ?? [];
  const scale = Math.max(waterfall?.total_ms ?? 1, ...spans.map((span) => span.end), 1);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8">
      <h1 className="text-2xl font-bold text-zinc-900">Performance</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Server time for the last 7 days. Tracing is on only when PERF_TRACE=1. Prefetches are {includePrefetch ? "included" : "hidden"}.
      </p>
      <p className="mt-2 text-sm">
        <Link href={includePrefetch ? "/admin/performance" : "/admin/performance?prefetch=1"} className="font-medium text-violet-700">
          {includePrefetch ? "Hide prefetches" : "Include prefetches"}
        </Link>
      </p>
      {error ? (
        <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error.message}</p>
      ) : stats.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">No traces yet. Open the app with PERF_TRACE=1 and come back.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Route</th>
                <th className="px-4 py-3 font-medium">Samples</th>
                <th className="px-4 py-3 font-medium">p50</th>
                <th className="px-4 py-3 font-medium">p95</th>
                <th className="px-4 py-3 font-medium">Queries</th>
                <th className="px-4 py-3 font-medium">Chain</th>
                <th className="px-4 py-3 font-medium">Slowest calls</th>
                <th className="px-4 py-3 font-medium">Payload</th>
                <th className="px-4 py-3 font-medium">JS</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={stat.route} className="border-b border-zinc-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <Link href={hrefFor(stat.route, undefined, includePrefetch)} className="text-violet-700">
                      {stat.route}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{stat.count}</td>
                  <td className="px-4 py-3">{stat.p50} ms</td>
                  <td className="px-4 py-3">{stat.p95} ms</td>
                  <td className="px-4 py-3">{stat.queries}</td>
                  <td className="px-4 py-3">{stat.depth}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {stat.slowest.map((call) => `${call.name} ${call.ms}ms`).join(", ")}
                  </td>
                  <td className="px-4 py-3">{kb(stat.responseBytes)}</td>
                  <td className="px-4 py-3">{kb(stat.jsBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {params.route ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-zinc-900">{params.route}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {routeTraces.map((row) => (
              <li key={row.id}>
                <Link
                  href={hrefFor(row.route, row.id, includePrefetch)}
                  className={`block rounded-xl px-3 py-2 text-sm ${row.id === waterfall?.id ? "bg-violet-50 text-violet-800" : "bg-white text-zinc-700"}`}
                >
                  {new Date(row.created_at).toLocaleString("en-GB", { timeZone: "Europe/London" })} · {row.total_ms} ms · {row.query_count} queries · chain {row.sequential_depth}
                  {row.persona ? ` · ${row.persona}` : ""}
                  {row.prefetch ? " · prefetch" : ""}
                </Link>
              </li>
            ))}
          </ul>
          {waterfall ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <p className="text-sm text-zinc-500">
                {waterfall.total_ms} ms total · deepest chain {waterfall.sequential_depth} calls / {waterfall.sequential_ms} ms. Violet bars ran one after another. Pale bars overlapped.
              </p>
              <ol className="mt-4 flex flex-col gap-2">
                {spans.map((span, index) => (
                  <li key={`${span.name}-${span.start}-${index}`} className="grid grid-cols-[9rem_1fr_5.5rem] items-center gap-3 text-xs">
                    <span className="truncate font-medium text-zinc-800">
                      {span.name}
                      <span className="ml-1 font-normal text-zinc-400">{span.op}</span>
                    </span>
                    <span className="relative h-3 rounded-full bg-zinc-100">
                      <span
                        className={`absolute inset-y-0 rounded-full ${span.parallel ? "bg-violet-300" : "bg-violet-600"}`}
                        style={{
                          left: `${(span.start / scale) * 100}%`,
                          width: `${Math.max(1, (span.ms / scale) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className="text-right text-zinc-600">
                      {span.ms} ms{span.rows != null ? ` · ${span.rows}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
