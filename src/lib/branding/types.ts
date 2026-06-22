export type SiteBranding = {
  logoUrl: string | null;
  iconUrl: string | null;
  faviconUrl: string | null;
};

export const EMPTY_SITE_BRANDING: SiteBranding = {
  logoUrl: null,
  iconUrl: null,
  faviconUrl: null,
};

export type BrandingAssetType = "logo" | "icon" | "favicon";
