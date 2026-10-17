export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.PERF_TRACE !== "1") return;
  const { installPerfTracing } = await import("@/lib/perf/install");
  installPerfTracing();
}
