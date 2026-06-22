import type { SiteBranding } from "@/lib/branding/types";

type KiddaLogoImageProps = {
  variant?: "logo" | "icon" | "wordmark";
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  branding: SiteBranding;
};

const LOGO_SIZE = {
  xs: "h-5",
  sm: "h-7",
  md: "h-9",
  lg: "h-12",
} as const;

const ICON_SIZE = {
  xs: "h-5 w-5",
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
} as const;

const WORDMARK_SIZE = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
} as const;

function WordmarkFallback({ size }: { size: string }) {
  return (
    <span className={`font-semibold uppercase tracking-widest text-violet-600 ${size}`}>
      Kidda
    </span>
  );
}

function IconFallback({ className }: { className: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-xl bg-violet-600 font-bold text-white ${className}`}
      aria-hidden="true"
    >
      K
    </span>
  );
}

export function KiddaLogoImage({
  variant = "logo",
  size = "md",
  className = "",
  branding,
}: KiddaLogoImageProps) {
  if (variant === "icon") {
    return branding.iconUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={branding.iconUrl}
        alt="Kidda"
        className={`object-contain ${ICON_SIZE[size]} ${className}`}
      />
    ) : (
      <IconFallback className={ICON_SIZE[size]} />
    );
  }

  if (variant === "wordmark") {
    return <WordmarkFallback size={WORDMARK_SIZE[size]} />;
  }

  return branding.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={branding.logoUrl}
      alt="Kidda"
      className={`object-contain ${LOGO_SIZE[size]} ${className}`}
    />
  ) : (
    <WordmarkFallback size={WORDMARK_SIZE[size]} />
  );
}
