"use server";

import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { extensionForBrandingFile, validateBrandingFile } from "@/lib/branding/validate-branding-file";
import type { BrandingAssetType, SiteBranding } from "@/lib/branding/types";
import { EMPTY_SITE_BRANDING } from "@/lib/branding/types";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActionResult = { error?: string; success?: string };

const COLUMN: Record<BrandingAssetType, string> = {
  logo: "logo_url",
  icon: "icon_url",
  favicon: "favicon_url",
};

async function requireAdmin() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user || !(await canAccessAdminPanel(user, authClient))) {
    throw new Error("Unauthorized");
  }

  return createServiceRoleClient();
}

function withBrandingSqlHint(message: string): string {
  if (message.includes("site_branding")) {
    return `${message} Run supabase/site-branding.sql in the Supabase SQL Editor, then retry.`;
  }
  if (message.toLowerCase().includes("bucket not found")) {
    return `${message} Run supabase/site-branding.sql in the Supabase SQL Editor, then retry.`;
  }
  return message;
}

export async function loadBrandingForAdmin(): Promise<SiteBranding> {
  try {
    const supabase = await requireAdmin();
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
}

export type BrandingUploadResult = ActionResult & { url?: string };

export async function uploadBrandingAsset(
  assetType: BrandingAssetType,
  formData: FormData
): Promise<BrandingUploadResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file?.size) return { error: "Choose a file to upload." };

    const validationError = validateBrandingFile(assetType, file);
    if (validationError) return { error: validationError };

    const supabase = await requireAdmin();
    const ext = extensionForBrandingFile(file);
    const path = `${assetType}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("site-branding")
      .upload(path, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return { error: withBrandingSqlHint(uploadError.message) };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("site-branding").getPublicUrl(path);

    const { error: dbError } = await supabase.from("site_branding").upsert({
      id: "default",
      [COLUMN[assetType]]: publicUrl,
      updated_at: new Date().toISOString(),
    });

    if (dbError) {
      return { error: withBrandingSqlHint(dbError.message) };
    }

    revalidatePath("/", "layout");
    revalidatePath("/dashboard/home");
    revalidatePath("/admin/content");
    revalidatePath("/login");
    revalidatePath("/signup");

    return {
      success: `${assetType} updated.`,
      url: `${publicUrl}?v=${Date.now()}`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Upload failed.",
    };
  }
}
