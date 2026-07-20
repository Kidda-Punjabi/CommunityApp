"use client";

import { getStripePublishableKey } from "@/lib/products/checkout";
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useMemo, useState } from "react";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    const key = getStripePublishableKey();
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}

type EmbeddedCheckoutBlockProps = {
  checkoutKey: string;
  className?: string;
  cohortId?: string;
  cohortSeatHoldId?: string;
};

export function EmbeddedCheckoutBlock({
  checkoutKey,
  className,
  cohortId,
  cohortSeatHoldId,
}: EmbeddedCheckoutBlockProps) {
  const [error, setError] = useState<string | null>(null);
  const publishableKey = getStripePublishableKey();

  const fetchClientSecret = useMemo(
    () => async () => {
      setError(null);
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutKey,
          embedded: true,
          ...(cohortId && cohortSeatHoldId ? { cohortId, cohortSeatHoldId } : {}),
        }),
      });

      const data = (await response.json()) as {
        clientSecret?: string;
        url?: string;
        error?: string;
      };

      if (data.clientSecret) return data.clientSecret;

      if (data.url) {
        window.location.href = data.url;
        return "";
      }

      const message = data.error ?? "Could not start checkout.";
      setError(message);
      throw new Error(message);
    },
    [checkoutKey, cohortId, cohortSeatHoldId]
  );

  if (!publishableKey) {
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Checkout is not fully configured. Add your Stripe publishable key to enable in-page
        checkout.
      </p>
    );
  }

  return (
    <div className={className}>
      {error && (
        <p className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
