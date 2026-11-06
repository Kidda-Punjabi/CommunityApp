/**
 * Fire-and-forget P2 from browser code. Safe to import from client bundles —
 * it never pulls in APNs / node:http2.
 */
export function queueLevelCheckReadyPush(): void {
  if (typeof window === "undefined") return;
  void fetch("/api/push/level-check-ready", { method: "POST", credentials: "include" }).catch(
    () => {}
  );
}
