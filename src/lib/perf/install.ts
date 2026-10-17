import { perfAls, rememberTrace, traceForId } from "@/lib/perf/context";
import { installGlobalFetch } from "@/lib/perf/fetch";
import { persistTrace, serverTimingHeader, summarizeTrace } from "@/lib/perf/persist";
import { createTrace, type PerfTrace } from "@/lib/perf/types";
import { Server as HttpServer, type IncomingMessage, type ServerResponse } from "node:http";

function headerValue(req: IncomingMessage, name: string): string {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function attach(req: IncomingMessage, res: ServerResponse, trace: PerfTrace) {
  trace.method = req.method || "GET";
  trace.route = headerValue(req, "x-pathname") || (req.url || "").split("?")[0] || "";
  trace.persona = headerValue(req, "x-perf-persona").slice(0, 40);
  const rawMiddleware = headerValue(req, "x-perf-mw-ms");
  const middlewareMs = Number(rawMiddleware);
  if (rawMiddleware && Number.isFinite(middlewareMs) && middlewareMs >= 0) {
    trace.middlewareMs = Math.round(middlewareMs);
    trace.sawMiddleware = true;
  }
  const prefetch = headerValue(req, "next-router-prefetch") === "1" || headerValue(req, "purpose") === "prefetch";
  trace.prefetch = prefetch;

  const originalEnd = res.end;
  res.end = function endWithTiming(this: ServerResponse, ...args: unknown[]) {
    const shared = traceForId(headerValue(req, "x-perf-id")) ?? trace;
    const summary = summarizeTrace(shared);
    const header = serverTimingHeader(summary);
    try {
      if (!res.headersSent) res.setHeader("Server-Timing", header);
      else res.addTrailers({ "Server-Timing": header });
    } catch {
      // The response can already be closed. The trace is still logged.
    }
    const result = originalEnd.apply(this, args as Parameters<ServerResponse["end"]>);
    // Pages persist from after(), once rendering has finished. A route handler
    // never reaches the root layout; persist it here when it made calls.
    if (!shared.holdForAfter && shared.spans.length > 0) void persistTrace(shared);
    return result;
  } as ServerResponse["end"];
}

export function installPerfTracing() {
  installGlobalFetch();
  const server = HttpServer.prototype as HttpServer & { __kiddaPerfPatched?: boolean };
  if (server.__kiddaPerfPatched) return;
  server.__kiddaPerfPatched = true;
  const originalEmit = HttpServer.prototype.emit;
  HttpServer.prototype.emit = function patchedEmit(event: string, ...args: unknown[]) {
    if (event !== "request") return originalEmit.apply(this, [event, ...args] as never);
    const req = args[0] as IncomingMessage | undefined;
    const res = args[1] as ServerResponse | undefined;
    if (!req || !res) return originalEmit.apply(this, [event, ...args] as never);
    const trace = createTrace();
    trace.id = headerValue(req, "x-perf-id");
    if (trace.id) rememberTrace(trace.id, trace);
    attach(req, res, trace);
    return perfAls.run(trace, () => originalEmit.apply(this, [event, ...args] as never));
  };
}
