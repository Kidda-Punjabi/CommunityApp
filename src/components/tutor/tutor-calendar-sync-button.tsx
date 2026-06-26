"use client";

import { formatGoogleCalendarError } from "@/lib/calendar/format-google-error";
import { useState } from "react";
import { ui } from "@/lib/ui/styles";

export function TutorCalendarSyncButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = async (forceFullSync = false) => {
    setPending(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/google/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceFullSync }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 504) {
        setError(
          "Sync timed out on the server. Try again — later syncs are faster once your calendar is linked."
        );
        return;
      }
      if (!res.ok) {
        setError(formatGoogleCalendarError(data.error ?? "Sync failed."));
        return;
      }
      setMessage(
        `Synced ${data.synced} lesson${data.synced === 1 ? "" : "s"}` +
          (data.skipped > 0 ? ` · ${data.skipped} other calendar events ignored` : "") +
          "."
      );
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
        onClick={() => void sync(false)}
        disabled={pending}
        className={ui.btnSecondary}
      >
        {pending ? "Syncing…" : "Sync calendar now"}
      </button>
      <button
        type="button"
        onClick={() => void sync(true)}
        disabled={pending}
        className={ui.btnGhost}
      >
        Full resync
      </button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
