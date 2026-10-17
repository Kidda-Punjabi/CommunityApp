"use client";

import { InlineSpinner } from "@/components/ui/page-spinner";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} className={className}>
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? <InlineSpinner /> : null}
        {children}
      </span>
    </button>
  );
}
