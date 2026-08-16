export function LockedCertificateRow({
  title,
  cefr,
  hint,
}: {
  title: string;
  cefr: string;
  hint: string;
}) {
  return (
    <div className="w-full rounded-3xl border border-zinc-200 bg-zinc-50 p-4 opacity-80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-heading text-base font-semibold text-zinc-700">{title}</p>
          <p className="mt-0.5 text-xs font-medium text-zinc-500">CEFR {cefr}</p>
        </div>
        <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
          Locked
        </span>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
