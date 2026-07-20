"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";

const inputClassName =
  "block w-full rounded-lg border border-zinc-300 py-2.5 pl-3 pr-[4.5rem] text-zinc-900 placeholder:text-zinc-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20";

type PasswordInputProps = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  label: string;
  /** Optional content under the field (e.g. Forgot password link). */
  footer?: ReactNode;
};

/**
 * Password field with show/hide controls (label link + in-field button).
 */
export function PasswordInput({
  label,
  id,
  footer,
  className,
  ...props
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  const toggle = () => setVisible((v) => !v);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700">
          {label}
        </label>
        <button
          type="button"
          onClick={toggle}
          className="shrink-0 text-sm font-semibold text-violet-600 hover:text-violet-500"
          aria-pressed={visible}
          aria-controls={inputId}
        >
          {visible ? "Hide password" : "Show password"}
        </button>
      </div>
      <div className="relative mt-1.5">
        <input
          {...props}
          id={inputId}
          type={visible ? "text" : "password"}
          className={className ?? inputClassName}
        />
        <button
          type="button"
          onClick={toggle}
          className="absolute inset-y-0 right-0 z-10 flex min-w-[2.75rem] items-center justify-center rounded-r-lg border-l border-zinc-200 bg-zinc-50 px-2 text-violet-600 transition-colors hover:bg-violet-50"
          aria-pressed={visible}
          aria-controls={inputId}
          aria-label={visible ? "Hide password" : "Show password"}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
      {footer}
    </div>
  );
}
