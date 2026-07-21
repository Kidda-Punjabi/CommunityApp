"use client";

import { useCallback, useRef } from "react";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";

type TranslatePrimaryButtonProps = {
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onActivate: () => void;
};

/**
 * Full-width primary CTA for translate flows. Sits above the fixed tab bar with
 * an elevated z-index and touch-friendly handlers for iOS Safari.
 */
export function TranslatePrimaryButton({
  children,
  disabled = false,
  className,
  onActivate,
}: TranslatePrimaryButtonProps) {
  const lastTouchRef = useRef(0);

  const activate = useCallback(() => {
    if (disabled) return;
    onActivate();
  }, [disabled, onActivate]);

  const onTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLButtonElement>) => {
      if (disabled) return;
      lastTouchRef.current = Date.now();
      event.stopPropagation();
      activate();
    },
    [activate, disabled]
  );

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (Date.now() - lastTouchRef.current < 400) {
        event.preventDefault();
        return;
      }
      activate();
    },
    [activate, disabled]
  );

  return (
    <button
      type="button"
      disabled={disabled}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
      className={cn(
        pressableClass,
        "relative z-[51] w-full rounded-lg bg-violet-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-violet-500 disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Visually hidden file input that stays clickable on iOS (avoid `display: none`). */
export const photoCaptureInputClass =
  "absolute left-0 top-0 h-px w-px overflow-hidden opacity-0";
