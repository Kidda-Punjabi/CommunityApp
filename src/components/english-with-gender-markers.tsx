import { Fragment } from "react";

const GENDER_MARKER_PART = /^\([mf]\)$/i;

type EnglishWithGenderMarkersProps = {
  text: string;
  className?: string;
  markerClassName?: string;
  as?: "span" | "p";
};

/** Renders English glosses with subtle styling on (m) / (f) gender hints. */
export function EnglishWithGenderMarkers({
  text,
  className = "",
  markerClassName = "text-[0.72em] font-normal text-zinc-400",
  as: Component = "span",
}: EnglishWithGenderMarkersProps) {
  if (!/\([mf]\)/i.test(text)) {
    return <Component className={className}>{text}</Component>;
  }

  const parts = text.split(/(\([mf]\))/gi);

  return (
    <Component className={className}>
      {parts.map((part, index) =>
        GENDER_MARKER_PART.test(part) ? (
          <span key={index} className={markerClassName}>
            {part}
          </span>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        )
      )}
    </Component>
  );
}
