"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn, ui } from "@/lib/ui/styles";

const COPIED_RESET_MS = 1500;

const variantBase = {
  secondary: ui.btnSecondary,
  hub: "inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50",
} as const;

const variantCopied = {
  secondary: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
  hub: "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
} as const;

export type CopyButtonHandle = {
  copy: () => Promise<boolean>;
};

type CopyButtonProps = {
  text: string;
  children: ReactNode;
  variant?: keyof typeof variantBase;
  className?: string;
  disabled?: boolean;
  onCopySuccess?: () => void;
  onCopyError?: () => void;
};

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
    </svg>
  );
}

export const CopyButton = forwardRef<CopyButtonHandle, CopyButtonProps>(function CopyButton(
  { text, children, variant = "secondary", className, disabled, onCopySuccess, onCopyError },
  ref
) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const showCopied = useCallback(() => {
    setCopied(true);
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, COPIED_RESET_MS);
  }, [clearTimer]);

  const copy = useCallback(async () => {
    if (!text || disabled) return false;

    try {
      await navigator.clipboard.writeText(text);
      showCopied();
      onCopySuccess?.();
      return true;
    } catch {
      onCopyError?.();
      return false;
    }
  }, [text, disabled, showCopied, onCopySuccess, onCopyError]);

  useImperativeHandle(ref, () => ({ copy }), [copy]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void copy()}
      className={cn(
        variantBase[variant],
        "gap-1.5",
        copied && variantCopied[variant],
        className
      )}
    >
      {copied ? (
        <>
          <CheckIcon />
          Copied
        </>
      ) : (
        children
      )}
    </button>
  );
});
