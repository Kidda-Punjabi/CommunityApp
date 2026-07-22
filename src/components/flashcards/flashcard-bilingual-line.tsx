import { containsGurmukhi, latinRomanised } from "@/lib/conjugation/romanised";

type FlashcardBilingualLineProps = {
  text: string;
  romanised?: string | null;
  className?: string;
  gurmukhiClassName?: string;
  romanisedClassName?: string;
};

export function FlashcardBilingualLine({
  text,
  romanised,
  className = "",
  gurmukhiClassName = "font-semibold text-zinc-900",
  romanisedClassName = "mt-0.5 block text-sm font-normal text-violet-600",
}: FlashcardBilingualLineProps) {
  const latin = latinRomanised(romanised);
  const showRomanised = Boolean(latin) && containsGurmukhi(text);

  return (
    <span className={`block ${className}`}>
      <span className={gurmukhiClassName}>{text}</span>
      {showRomanised ? <span className={romanisedClassName}>{latin}</span> : null}
    </span>
  );
}
