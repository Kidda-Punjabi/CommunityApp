import { getEventColor } from "@/lib/calendar/time-grid-calendar";
import type { InviteeDotColor } from "@/lib/admin/calendar-session-display";
import { cn } from "@/lib/ui/styles";

export function InviteeDot({
  color,
  className,
}: {
  color: InviteeDotColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        color === "red" ? "bg-rose-500" : "bg-amber-400",
        className
      )}
      aria-hidden
    />
  );
}

type CalendarSessionLegendProps = {
  sampleColorIndex?: number;
};

export function CalendarSessionLegend({ sampleColorIndex = 0 }: CalendarSessionLegendProps) {
  const sampleColor = getEventColor(sampleColorIndex);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
      <span className="text-xs font-semibold text-zinc-500">Event key</span>

      <span className="inline-flex items-center gap-2 text-xs text-zinc-700">
        <span
          className={cn(
            "h-4 w-6 rounded border-l-4 shadow-sm",
            sampleColor.bg,
            sampleColor.border
          )}
        />
        Lesson showing in their account
      </span>

      <span className="inline-flex items-center gap-2 text-xs text-zinc-700">
        <span
          className={cn(
            "h-4 w-6 rounded border-l-4 opacity-45 saturate-[0.65]",
            sampleColor.bg,
            sampleColor.border
          )}
        />
        Personal
      </span>

      <span className="inline-flex items-center gap-2 text-xs text-zinc-700">
        <InviteeDot color="red" />
        No Kidda account
      </span>

      <span className="inline-flex items-center gap-2 text-xs text-zinc-700">
        <InviteeDot color="yellow" />
        Not showing in their account yet
      </span>
    </div>
  );
}

export function SessionTitleWithInviteeDot({
  title,
  inviteeDot,
  className,
}: {
  title: string;
  inviteeDot: InviteeDotColor | null;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {inviteeDot ? <InviteeDot color={inviteeDot} /> : null}
      <span className="truncate">{title}</span>
    </span>
  );
}
