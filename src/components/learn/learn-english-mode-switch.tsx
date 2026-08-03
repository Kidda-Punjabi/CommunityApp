"use client";

import {
  disableLearnEnglishMode,
  enableLearnEnglishMode,
} from "@/app/dashboard/learn/english-mode-actions";
import { cn } from "@/lib/ui/styles";
import { useFormStatus } from "react-dom";

type LearnEnglishModeSwitchProps = {
  enabled: boolean;
  courseLabel: string;
};

function SwitchControl({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? "Turn off Learn English" : "Turn on Learn English"}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
        enabled ? "bg-emerald-600" : "bg-zinc-300",
        pending && "opacity-60"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
          enabled && "translate-x-5"
        )}
      />
    </button>
  );
}

export function LearnEnglishModeSwitch({
  enabled,
  courseLabel,
}: LearnEnglishModeSwitchProps) {
  return (
    <form
      action={enabled ? disableLearnEnglishMode : enableLearnEnglishMode}
      data-tour="learn-tile-english"
      className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900">Learn English</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{courseLabel}</p>
      </div>
      <SwitchControl enabled={enabled} />
    </form>
  );
}
