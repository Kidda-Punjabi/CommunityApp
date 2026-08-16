"use client";

import { pressableClass } from "@/lib/ui/pressable";
import { cn } from "@/lib/ui/styles";
import { useState } from "react";

type RegisterInterestButtonProps = {
  courseTitle: string;
  className?: string;
};

export function RegisterInterestButton({
  courseTitle,
  className,
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
        "rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm",
        className
      )}
    >
      {done ? "Interest registered" : "Register interest"}
      <span className="sr-only"> for {courseTitle}</span>
    </button>
  );
}
