type EnglishExamQuestionImageProps = {
  imageUrl: string | null | undefined;
  attribution: string | null | undefined;
  className?: string;
};

/**
 * Official DfT traffic-sign (or other) question image + required licence line.
 * Renders nothing when imageUrl is empty so other questions stay unchanged.
 */
export function EnglishExamQuestionImage({
  imageUrl,
  attribution,
  className,
}: EnglishExamQuestionImageProps) {
  const url = imageUrl?.trim();
  if (!url) return null;

  const credit =
    attribution?.trim() ||
    "Traffic signs are Crown copyright.";

  return (
    <figure className={className ?? "mb-4"}>
      <div className="flex justify-center rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- public Supabase storage URL */}
        <img
          src={url}
          alt="Traffic sign for this question"
          className="max-h-44 w-auto max-w-full object-contain"
          loading="lazy"
        />
      </div>
      <figcaption className="mt-1.5 text-center text-[11px] leading-snug text-zinc-500">
        {credit}
      </figcaption>
    </figure>
  );
}
