import { KiddaLogoImage } from "@/components/branding/kidda-logo-image";
import { loadSiteBranding } from "@/lib/branding/load-site-branding";

export async function LandingMascot() {
  const branding = await loadSiteBranding();

  return (
    <div
      className="relative mx-auto flex max-w-md items-center justify-center lg:mx-0 lg:max-w-none"
      aria-hidden
    >
      <div className="absolute h-[min(88vw,22rem)] w-[min(88vw,22rem)] rounded-full bg-violet-100/70 sm:h-80 sm:w-80 lg:h-[22rem] lg:w-[22rem]" />
      <div className="relative flex h-[min(76vw,18rem)] w-[min(76vw,18rem)] items-center justify-center rounded-full bg-gradient-to-br from-violet-100 via-violet-50 to-white shadow-[0_24px_64px_-24px_rgba(124,58,237,0.35)] ring-1 ring-violet-100 sm:h-72 sm:w-72 lg:h-[19rem] lg:w-[19rem]">
        {branding.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.iconUrl}
            alt=""
            className="h-[68%] w-[68%] object-contain drop-shadow-sm"
          />
        ) : (
          <KiddaLogoImage
            variant="icon"
            size="lg"
            branding={branding}
            className="!h-32 !w-32 sm:!h-40 sm:!w-40"
          />
        )}
      </div>
    </div>
  );
}
