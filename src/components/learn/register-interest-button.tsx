"use client";

import { registerCourseInterest } from "@/app/dashboard/learn/interest-actions";
import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { useState, useTransition } from "react";

type RegisterInterestButtonProps = {
  courseTitle: string;
  courseLevel: "intermediate" | "advanced";
  className?: string;
  compact?: boolean;
  initiallyRegistered?: boolean;
};

export function RegisterInterestButton({
  courseTitle,
  courseLevel,
  className,
  compact = false,
  initiallyRegistered = false,
}: RegisterInterestButtonProps) {
  const [done, setDone] = useState(initiallyRegistered);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="shrink-0">
      <button
        type="button"
        disabled={done || pending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setError(null);
          startTransition(async () => {
            const result = await registerCourseInterest(courseLevel);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            setDone(true);
          });
        }}
        className={cn(
          pressableClass,
          "whitespace-nowrap rounded-full font-semibold text-white shadow-sm disabled:opacity-80",
          compact ? "px-2 py-1 text-[10px] leading-none" : "px-3.5 py-1.5 text-xs",
          className
        )}
      >
        {done ? "Interest registered" : pending ? "Saving…" : "Register interest"}
        <span className="sr-only"> for {courseTitle}</span>
      </button>
      {error ? <span className="mt-1 block text-[10px] font-medium text-red-600">{error}</span> : null}
    </span>
  );
}
