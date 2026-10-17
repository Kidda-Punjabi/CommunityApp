export type PerfSpan = {
  kind: "supabase" | "external";
  name: string;
  op: string;
  ms: number;
  rows: number | null;
  bytes: number | null;
  start: number;
  end: number;
  parallel: boolean;
};

export type PerfTrace = {
  started: number;
  id: string;
  route: string;
  method: string;
  persona: string;
  prefetch: boolean;
  middlewareMs: number;
  sawMiddleware: boolean;
  inflight: number;
  sealed: boolean;
  persisted: boolean;
  holdForAfter: boolean;
  spans: PerfSpan[];
  pending: Promise<void>[];
};

export function perfEnabled(): boolean {
  return process.env.PERF_TRACE === "1";
}

export function createTrace(): PerfTrace {
  return {
    started: performance.now(),
    id: "",
    route: "",
    method: "GET",
    persona: "",
    prefetch: false,
    middlewareMs: 0,
    sawMiddleware: false,
    inflight: 0,
    sealed: false,
    persisted: false,
    holdForAfter: false,
    spans: [],
    pending: [],
  };
}
