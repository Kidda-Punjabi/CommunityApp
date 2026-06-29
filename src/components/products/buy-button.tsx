"use client";

import { useState } from "react";

type BuyButtonProps = {
  checkoutKey: string;
  label?: string;
  className?: string;
  configured: boolean;
  fallbackUrl?: string | null;
  href?: string;
};

export function BuyButton({
  checkoutKey,
  label = "Buy Now",
  className,
  configured,
  fallbackUrl,
  href,
}: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (href) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (!configured) {
      if (fallbackUrl) {
        window.open(fallbackUrl, "_blank", "noopener,noreferrer");
        return;
      }
      setError("Checkout is not configured yet. Please contact support.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutKey }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not start checkout.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={
          className ??
          "inline-flex w-full items-center justify-center rounded-full bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.5)] transition-colors hover:bg-violet-500 disabled:opacity-60"
        }
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-2 text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
