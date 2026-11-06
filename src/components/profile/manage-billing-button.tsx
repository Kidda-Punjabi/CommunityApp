"use client";

import { useNativeApp } from "@/lib/native/native-app-context";

import { useState } from "react";

type ManageBillingButtonProps = {
  className?: string;
};

function ManageBillingButtonInApp({ className }: ManageBillingButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/billing-portal", { method: "POST" });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not open billing portal.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          className ??
          "inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-50 disabled:opacity-60"
        }
      >
        {loading ? "Opening…" : "Manage subscription"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** In the iOS and Android apps, purchases are not offered (App Store guideline 3.1.1). */
export function ManageBillingButton(props: ManageBillingButtonProps) {
  const native = useNativeApp();
  return native ? null : <ManageBillingButtonInApp {...props} />;
}
