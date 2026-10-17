import "server-only";

import { cache } from "react";
import { AsyncLocalStorage } from "node:async_hooks";
import { createTrace, perfEnabled, type PerfTrace } from "@/lib/perf/types";

export const perfAls = new AsyncLocalStorage<PerfTrace>();

const tracesById = new Map<string, PerfTrace>();
const boundHeaders = new WeakMap<PerfTrace, { get(name: string): string }>();

export function bindTraceRequest(trace: PerfTrace, read: { get(name: string): string }) {
  boundHeaders.set(trace, read);
}

function adoptBoundHeaders(trace: PerfTrace) {
  const read = boundHeaders.get(trace);
  if (!read) return;
  const rawMiddleware = read.get("x-perf-mw-ms");
  if (rawMiddleware) {
    const middlewareMs = Number(rawMiddleware);
    if (Number.isFinite(middlewareMs) && middlewareMs >= 0) {
      trace.sawMiddleware = true;
      trace.middlewareMs = Math.round(middlewareMs);
    }
  }
  const id = read.get("x-perf-id");
  if (id) {
    trace.id = id;
    rememberTrace(id, trace);
  }
  const path = read.get("x-pathname");
  if (path) trace.route = path;
  const persona = read.get("x-perf-persona");
  if (persona) trace.persona = persona.slice(0, 40);
}

const requestFallback = cache(() => createTrace());
const pinned = cache(() => ({ trace: null as PerfTrace | null }));

export function rememberTrace(id: string, trace: PerfTrace) {
  if (!id) return;
  tracesById.set(id, trace);
  if (tracesById.size <= 500) return;
  const oldest = tracesById.keys().next().value;
  if (oldest) tracesById.delete(oldest);
}

export function forgetTrace(id: string) {
  if (id) tracesById.delete(id);
}

export function traceForId(id: string): PerfTrace | null {
  if (!id) return null;
  return tracesById.get(id) ?? null;
}

function applyRequestHeaders(trace: PerfTrace, headerList: Headers) {
  const path = headerList.get("x-pathname");
  if (path) trace.route = path;
  const method = headerList.get("x-perf-method");
  if (method) trace.method = method;
  const persona = headerList.get("x-perf-persona");
  if (persona) trace.persona = persona.slice(0, 40);
  const rawMiddleware = headerList.get("x-perf-mw-ms");
  if (rawMiddleware != null && rawMiddleware !== "") {
    const middlewareMs = Number(rawMiddleware);
    if (Number.isFinite(middlewareMs) && middlewareMs >= 0) {
      trace.sawMiddleware = true;
      trace.middlewareMs = Math.round(middlewareMs);
    }
  }
  const prefetch =
    headerList.get("next-router-prefetch") === "1" || headerList.get("purpose") === "prefetch";
  if (prefetch) trace.prefetch = true;
}

export function activeTrace(): PerfTrace | null {
  if (!perfEnabled()) return null;
  const stored = perfAls.getStore();
  if (stored) return stored;
  try {
    const slot = pinned();
    if (slot.trace) return slot.trace;
    return requestFallback();
  } catch {
    return null;
  }
}

export function resolveTraceSync(): PerfTrace | null {
  if (!perfEnabled()) return null;
  const als = perfAls.getStore();
  if (als) {
    adoptBoundHeaders(als);
    if (als.id) {
      const existing = tracesById.get(als.id);
      if (existing && existing !== als) return existing;
    }
    return als;
  }
  try {
    const slot = pinned();
    if (slot.trace) return slot.trace;
    const trace = requestFallback();
    slot.trace = trace;
    return trace;
  } catch {
    return null;
  }
}

export function noteRequest(headerList: Headers): PerfTrace | null {
  if (!perfEnabled()) return null;
  const id = headerList.get("x-perf-id") || "";
  const shared = id ? tracesById.get(id) : undefined;
  const trace = shared ?? resolveTraceSync();
  if (!trace) return null;
  if (id) {
    trace.id = id;
    rememberTrace(id, trace);
  }
  try {
    pinned().trace = trace;
  } catch {
    // Outside a React request the AsyncLocalStorage fallback still holds the trace.
  }
  applyRequestHeaders(trace, headerList);
  trace.holdForAfter = true;
  return trace;
}
