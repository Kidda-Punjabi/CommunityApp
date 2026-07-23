import { latinRomanised } from "@/lib/conjugation/romanised";

type ChadoPauriGroupOptionLabelProps = {
  gurmukhi: string;
  romanised: string | null;
  label?: string;
  className?: string;
};

export function ChadoPauriGroupOptionLabel({
  gurmukhi,
  romanised,
  label,
  className = "",
}: ChadoPauriGroupOptionLabelProps) {
  const latin = latinRomanised(romanised);
  return (
    <span className={`block ${className}`}>
      {label ? (
        <span className="mr-2 text-xs font-bold uppercase tracking-wide text-zinc-400">
          {label}
        </span>
      ) : null}
      <span className="font-semibold text-zinc-900">{gurmukhi}</span>
      {latin ? (
        <span className="mt-0.5 block text-sm font-normal text-violet-600">{latin}</span>
      ) : null}
    </span>
  );
}
