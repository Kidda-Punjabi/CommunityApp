import { containsGurmukhi, latinRomanised } from "@/lib/conjugation/romanised";

const GURMUKHI_RUN = /([\u0A00-\u0A7F]+)/;

type FlashcardBilingualLineProps = {
  text: string;
  romanised?: string | null;
  className?: string;
  gurmukhiClassName?: string;
  /** Applied only to Gurmukhi characters, so Latin in the same tile keeps the parent size. */
  emphasizeGurmukhiClassName?: string;
  romanisedClassName?: string;
};

export function FlashcardBilingualLine({
  text,
  romanised,
  className = "",
  gurmukhiClassName = "font-semibold text-zinc-900",
  emphasizeGurmukhiClassName,
  romanisedClassName = "mt-0.5 block text-sm font-normal text-violet-600",
}: FlashcardBilingualLineProps) {
  const latin = latinRomanised(romanised);
  const showRomanised = Boolean(latin) && containsGurmukhi(text);
  const runs = emphasizeGurmukhiClassName ? text.split(GURMUKHI_RUN).filter(Boolean) : null;

  return (
    <span className={`block ${className}`}>
      {runs ? (
        runs.map((part, index) =>
          containsGurmukhi(part) ? (
            <span key={index} className={`${gurmukhiClassName} ${emphasizeGurmukhiClassName}`}>
              {part}
            </span>
          ) : (
            <span key={index}>{part}</span>
          )
        )
      ) : (
        <span className={gurmukhiClassName}>{text}</span>
      )}
      {showRomanised ? <span className={romanisedClassName}>{latin}</span> : null}
    </span>
  );
}
