import { latinRomanised } from "@/lib/conjugation/romanised";
import { splitBilingual } from "@/lib/group-games/split-bilingual";

type ChadoPauriGroupOptionLabelProps = {
  gurmukhi: string;
  romanised: string | null;
  label?: string;
  className?: string;
};

/** Punjabi on top (large), romanised underneath (small). Each shown once. */
export function ChadoPauriGroupOptionLabel({
  gurmukhi,
  romanised,
  label,
  className = "",
}: ChadoPauriGroupOptionLabelProps) {
  const { main, bracketLatin } = splitBilingual(gurmukhi);
  const latin = latinRomanised(romanised) ?? bracketLatin;
  return (
    <span className={`block ${className}`}>
      {label ? (
        <span className="mr-2 text-xs font-bold uppercase tracking-wide text-zinc-400">
          {label}
        </span>
      ) : null}
      <span className="text-xl font-semibold leading-snug text-zinc-900">{main}</span>
      {latin ? (
        <span className="mt-1 block text-sm font-medium text-zinc-500">{latin}</span>
      ) : null}
    </span>
  );
}
