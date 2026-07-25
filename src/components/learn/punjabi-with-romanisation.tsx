"use client";

type PunjabiWithRomanisationProps = {
  gurmukhi: string;
  romanised?: string | null;
  className?: string;
  textClassName?: string;
  romanisedClassName?: string;
};

/** Gurmukhi line with optional romanisation underneath for non-readers. */
export function PunjabiWithRomanisation({
  gurmukhi,
  romanised,
  className,
  textClassName,
  romanisedClassName = "mt-0.5 block text-[11px] font-normal text-violet-600",
}: PunjabiWithRomanisationProps) {
  const hint = romanised?.trim() || null;
  return (
    <span className={className}>
      <span className={textClassName ?? "block"}>{gurmukhi}</span>
      {hint ? <span className={romanisedClassName}>{hint}</span> : null}
    </span>
  );
}
