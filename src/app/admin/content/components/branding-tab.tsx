"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KiddaLogoImage } from "@/components/branding/kidda-logo-image";
import type { BrandingAssetType, SiteBranding } from "@/lib/branding/types";
import { uploadBrandingAsset } from "../branding-actions";
import { FormMessage, SectionCard, buttonClass, labelClass } from "./ui";

type BrandingTabProps = {
  initialBranding: SiteBranding;
};

const ASSETS: {
  type: BrandingAssetType;
  title: string;
  description: string;
  accept: string;
  hint: string;
}[] = [
  {
    type: "logo",
    title: "Logo",
    description: "Full logo for sign-in pages, marketing, and headers.",
    accept: "image/png,image/jpeg,image/webp,image/svg+xml",
    hint: "PNG, JPG, WebP, or SVG · max 2 MB · horizontal logo works best",
  },
  {
    type: "icon",
    title: "Icon",
    description: "Compact mark for the home greeting and tight spaces.",
    accept: "image/png,image/jpeg,image/webp,image/svg+xml",
    hint: "Square icon · PNG, JPG, WebP, or SVG · max 2 MB",
  },
  {
    type: "favicon",
    title: "Favicon",
    description: "Browser tab icon for the whole app.",
    accept: "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico",
    hint: "PNG, ICO, or SVG · 32×32 or 64×64 recommended · max 2 MB",
  },
];

function assetUrl(branding: SiteBranding, type: BrandingAssetType): string | null {
  if (type === "logo") return branding.logoUrl;
  if (type === "icon") return branding.iconUrl;
  return branding.faviconUrl;
}

function BrandingAssetUpload({
  asset,
  branding,
  onUploaded,
}: {
  asset: (typeof ASSETS)[number];
  branding: SiteBranding;
  onUploaded: (type: BrandingAssetType, url: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; success?: string }>({});
  const currentUrl = assetUrl(branding, asset.type);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage({});

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await uploadBrandingAsset(asset.type, formData);
      if (result.error) {
        setMessage({ error: result.error });
        return;
      }
      if (result.url) onUploaded(asset.type, result.url);
      setMessage({ success: result.success ?? "Uploaded." });
      event.currentTarget.reset();
    });
  }

  return (
    <SectionCard title={asset.title}>
      <p className="mb-4 text-sm text-zinc-600">{asset.description}</p>

      <div className="mb-4 flex items-center gap-4 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
        {asset.type === "logo" && (
          <KiddaLogoImage variant="logo" size="lg" branding={branding} />
        )}
        {asset.type === "icon" && (
          <KiddaLogoImage variant="icon" size="lg" branding={branding} />
        )}
        {asset.type === "favicon" && (
          currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUrl} alt="Favicon preview" className="h-8 w-8 object-contain" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded bg-violet-600 text-xs font-bold text-white">
              K
            </span>
          )
        )}
        <div className="min-w-0 text-xs text-zinc-500">
          {currentUrl ? (
            <p className="truncate">{currentUrl.split("?")[0]}</p>
          ) : (
            <p>No file uploaded yet — the default Kidda wordmark is shown.</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className={labelClass} htmlFor={`branding-${asset.type}`}>
            Upload {asset.title.toLowerCase()}
          </label>
          <input
            id={`branding-${asset.type}`}
            name="file"
            type="file"
            accept={asset.accept}
            required
            className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-violet-700 hover:file:bg-violet-100"
          />
          <p className="mt-1 text-xs text-zinc-500">{asset.hint}</p>
        </div>

        <FormMessage state={message} />

        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Uploading…" : `Save ${asset.title.toLowerCase()}`}
        </button>
      </form>
    </SectionCard>
  );
}

export function BrandingTab({ initialBranding }: BrandingTabProps) {
  const router = useRouter();
  const [branding, setBranding] = useState(initialBranding);

  function handleUploaded(type: BrandingAssetType, url: string) {
    const baseUrl = url.split("?")[0];
    setBranding((current) => ({
      ...current,
      ...(type === "logo"
        ? { logoUrl: baseUrl }
        : type === "icon"
          ? { iconUrl: baseUrl }
          : { faviconUrl: baseUrl }),
    }));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Kidda branding">
        <p className="text-sm text-zinc-600">
          Upload your logo, compact icon, and favicon. They appear across sign-in, the home
          greeting (&quot;Welcome back to Kidda&quot;), and browser tabs.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          First time? Run <code className="rounded bg-zinc-100 px-1">supabase/site-branding.sql</code>{" "}
          in the Supabase SQL Editor.
        </p>
      </SectionCard>

      {ASSETS.map((asset) => (
        <BrandingAssetUpload
          key={asset.type}
          asset={asset}
          branding={branding}
          onUploaded={handleUploaded}
        />
      ))}
    </div>
  );
}
