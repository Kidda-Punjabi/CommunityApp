import "server-only";

import { createClient } from "@/lib/supabase/server";
import { cache } from "react";
import { EMPTY_SITE_BRANDING, type SiteBranding } from "./types";

export const loadSiteBranding = cache(async (): Promise<SiteBranding> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_branding")
      .select("logo_url, icon_url, favicon_url")
      .eq("id", "default")
      .maybeSingle();

    if (error || !data) return EMPTY_SITE_BRANDING;

    return {
      logoUrl: data.logo_url ?? null,
      iconUrl: data.icon_url ?? null,
      faviconUrl: data.favicon_url ?? null,
    };
  } catch {
    return EMPTY_SITE_BRANDING;
  }
});
