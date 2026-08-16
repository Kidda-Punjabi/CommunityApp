"use client";

import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { useState } from "react";

type RegisterInterestButtonProps = {
  courseTitle: string;
  className?: string;
  compact?: boolean;
};

export function RegisterInterestButton({
  courseTitle,
  className,
  compact = false,
}: RegisterInterestButtonProps) {
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setDone(true);
      }}
      className={cn(
        pressableClass,
        "shrink-0 whitespace-nowrap rounded-full font-semibold text-white shadow-sm",
        compact ? "px-2 py-1 text-[10px] leading-none" : "px-3.5 py-1.5 text-xs",
        className
      )}
    >
      {done ? "Interest registered" : "Register interest"}
      <span className="sr-only"> for {courseTitle}</span>
    </button>
  );
}
