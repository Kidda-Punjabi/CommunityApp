"use client";

import { EmbeddedCheckoutBlock } from "@/components/products/embedded-checkout-block";
import { isEmbeddedCheckoutConfigured } from "@/lib/products/checkout";
import { useState } from "react";

type CheckoutOption = {
  key: string;
  label: string;
};

type ProductCheckoutSectionProps = {
  options: CheckoutOption[];
  defaultKey?: string;
};

export function ProductCheckoutSection({ options, defaultKey }: ProductCheckoutSectionProps) {
  const available = options.filter((option) => isEmbeddedCheckoutConfigured(option.key));

  if (available.length === 0) {
    return null;
  }

  const initialKey = defaultKey && available.some((o) => o.key === defaultKey)
    ? defaultKey
    : available[0].key;

  return <ProductCheckoutSectionInner options={available} initialKey={initialKey} />;
}

function ProductCheckoutSectionInner({
  options,
  initialKey,
}: {
  options: CheckoutOption[];
  initialKey: string;
}) {
  const [activeKey, setActiveKey] = useState(initialKey);

  return (
    <section className="mt-8" id="checkout">
      <h3 className="text-center font-heading text-lg font-semibold text-zinc-900">
        Secure checkout
      </h3>
      <p className="mt-1 text-center text-sm text-zinc-500">
        Apple Pay, Google Pay, cards, and promo codes supported
      </p>

      {options.length > 1 && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setActiveKey(option.key)}
              className={
                activeKey === option.key
                  ? "rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:border-violet-200"
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <EmbeddedCheckoutBlock
        key={activeKey}
        checkoutKey={activeKey}
        className="mt-5"
      />
    </section>
  );
}
