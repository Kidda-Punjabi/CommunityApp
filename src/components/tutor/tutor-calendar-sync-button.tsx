"use client";

import { formatGoogleCalendarError } from "@/lib/calendar/format-google-error";
import { useState } from "react";
import { ui } from "@/lib/ui/styles";

export function TutorCalendarSyncButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = async () => {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/google/calendar/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(formatGoogleCalendarError(data.error ?? "Sync failed."));
        return;
      }
      setMessage(`Synced ${data.synced} event${data.synced === 1 ? "" : "s"} (${data.unmatched} unmatched).`);
      window.location.reload();
    } catch {
      setError("Sync failed.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void sync()}
        disabled={pending}
        className={ui.btnSecondary}
      >
        {pending ? "Syncing…" : "Sync calendar now"}
      </button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
