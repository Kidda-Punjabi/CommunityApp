import { KiddaLogoImage } from "@/components/branding/kidda-logo-image";
import { loadSiteBranding } from "@/lib/branding/load-site-branding";

export async function LandingMascot() {
  const branding = await loadSiteBranding();

  return (
    <div
      className="relative mx-auto flex max-w-[11rem] items-center justify-center sm:max-w-[16rem] lg:mx-0 lg:max-w-none"
      aria-hidden
    >
      {/* Soft halo — kept modest on phones so the hero doesn't dominate the first viewport */}
      <div className="absolute h-36 w-36 rounded-full bg-violet-100/70 sm:h-56 sm:w-56 lg:h-[22rem] lg:w-[22rem]" />
      <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 via-violet-50 to-white shadow-[0_16px_40px_-20px_rgba(124,58,237,0.35)] ring-1 ring-violet-100 sm:h-48 sm:w-48 sm:shadow-[0_24px_64px_-24px_rgba(124,58,237,0.35)] lg:h-[19rem] lg:w-[19rem]">
        {branding.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.iconUrl}
            alt=""
            className="h-[72%] w-[72%] object-contain drop-shadow-sm sm:h-[68%] sm:w-[68%]"
          />
        ) : (
          <KiddaLogoImage
            variant="icon"
            size="lg"
            branding={branding}
            className="!h-16 !w-16 sm:!h-28 sm:!w-28 lg:!h-40 lg:!w-40"
          />
        )}
      </div>
    </div>
  );
}
