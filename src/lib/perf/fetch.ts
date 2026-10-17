import "server-only";

import { resolveTraceSync } from "@/lib/perf/context";
import { contentRangeRows, describeCall } from "@/lib/perf/summarize";
import type { PerfSpan, PerfTrace } from "@/lib/perf/types";

function originalFetch(): typeof fetch {
  const saved = (globalThis as { __kiddaOriginalFetch?: typeof fetch }).__kiddaOriginalFetch;
  return saved ?? globalThis.fetch;
}

function rememberRows(trace: PerfTrace, span: PerfSpan, response: Response) {
  const ranged = contentRangeRows(response.headers.get("content-range"));
  if (ranged != null) {
    span.rows = ranged;
    return;
  }
  const length = Number(response.headers.get("content-length") || 0);
  const type = response.headers.get("content-type") || "";
  if (!type.includes("json") || length > 250_000) return;
  const pending = response
    .clone()
    .json()
    .then((body) => {
      span.rows = Array.isArray(body) ? body.length : body == null ? 0 : 1;
    })
    .catch(() => undefined);
  trace.pending.push(pending);
}

export function tracedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const trace = resolveTraceSync();
  const requestUrl = input instanceof Request ? input.url : input instanceof URL ? input.toString() : String(input);
  const method = init?.method || (input instanceof Request ? input.method : "GET");
  let target: ReturnType<typeof describeCall> = null;
  try {
    target = describeCall(new URL(requestUrl, "http://localhost"), method);
  } catch {
    target = null;
  }
  if (!trace || trace.sealed || !target) return originalFetch()(input, init);
  const call = target;

  trace.inflight += 1;
  const parallel = trace.inflight > 1;
  const start = performance.now();
  return originalFetch()(input, init)
    .then((response) => {
      const end = performance.now();
      const span: PerfSpan = {
        kind: call.kind,
        name: call.name,
        op: call.op,
        ms: Math.round(end - start),
        rows: null,
        bytes: Number(response.headers.get("content-length") || 0) || null,
        start: Math.round(start - trace.started),
        end: Math.round(end - trace.started),
        parallel,
      };
      trace.spans.push(span);
      rememberRows(trace, span, response);
      return response;
    })
    .finally(() => {
      trace.inflight -= 1;
    });
}

export function installGlobalFetch() {
  const holder = globalThis as { __kiddaOriginalFetch?: typeof fetch };
  if (globalThis.fetch === tracedFetch) return;
  holder.__kiddaOriginalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = tracedFetch;
}
