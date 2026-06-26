import { ui } from "@/lib/ui/styles";

type CalendarSchemaNoticeProps = {
  className?: string;
};

export function CalendarSchemaNotice({ className = "" }: CalendarSchemaNoticeProps) {
  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 ${className}`}>
      <p className="font-semibold">Calendar scheduling isn&apos;t set up yet</p>
      <p className="mt-1">
        Run <code className="text-xs">supabase/tutor-google-calendar.sql</code> in the Supabase SQL
        Editor, then refresh this page. Your tutor can connect Google Calendar after that.
      </p>
    </div>
  );
}
