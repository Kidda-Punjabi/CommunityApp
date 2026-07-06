"use client";

import { useState } from "react";

type PinPadProps = {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  onCancel?: () => void;
  error?: string | null;
  disabled?: boolean;
};

export function PinPad({
  title,
  subtitle,
  onComplete,
  onCancel,
  error,
  disabled = false,
}: PinPadProps) {
  const [value, setValue] = useState("");

  function addDigit(digit: string) {
    if (disabled || value.length >= 4) return;
    const next = value + digit;
    setValue(next);
    if (next.length === 4) {
      onComplete(next);
      setTimeout(() => setValue(""), 300);
    }
  }

  function backspace() {
    setValue((prev) => prev.slice(0, -1));
  }

  return (
    <div className="mx-auto w-full max-w-xs text-center">
      <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}

      <div className="mt-6 flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full border-2 ${
              value.length > i ? "border-violet-500 bg-violet-500" : "border-zinc-300"
            }`}
          />
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key) => {
          if (key === "") return <span key="spacer" />;
          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => (key === "⌫" ? backspace() : addDigit(key))}
              className="rounded-2xl bg-white py-4 text-xl font-semibold text-zinc-800 shadow-sm ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
            >
              {key}
            </button>
          );
        })}
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-6 text-sm font-medium text-zinc-500 hover:text-zinc-700"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
