"use client";

import { useNativeApp } from "@/lib/native/native-app-context";
import { NotSoldInApp } from "@/components/native/not-sold-in-app";

import { useState } from "react";
import Link from "next/link";
import { PREMIUM_UNLOCK_PATH } from "@/lib/products/premium-checkout";

type BuyButtonProps = {
  checkoutKey: string;
  label?: string;
  className?: string;
  configured: boolean;
};

function BuyButtonInApp({
  checkoutKey,
  label = "Buy Now",
  className,
  configured,
}: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!configured) {
      setError(
        "Checkout is not set up for this option yet. Please contact support or try the other course format."
      );
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

/** In the iOS and Android apps, purchases are not offered (App Store guideline 3.1.1). */
export function BuyButton(props: BuyButtonProps) {
  const native = useNativeApp();
  if (native) return <NotSoldInApp />;
  // Community has one plan, sold on the Premium page with the member's account attached.
  if (props.checkoutKey === "community") {
    return (
      <Link
        href={PREMIUM_UNLOCK_PATH}
        className={
          props.className ??
          "inline-flex w-full items-center justify-center rounded-full bg-violet-600 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.5)] transition-colors hover:bg-violet-500"
        }
      >
        {props.label ?? "Join"}
      </Link>
    );
  }
  return <BuyButtonInApp {...props} />;
}
