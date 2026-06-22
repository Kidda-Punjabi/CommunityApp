import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it from Supabase Dashboard → Project Settings → API (service_role key)."
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getServiceRoleConfigError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return "NEXT_PUBLIC_SUPABASE_URL is not set in the deployment environment.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is not set. Add it in Vercel → Settings → Environment Variables (Supabase service_role key), then redeploy.";
  }
  return null;
}

export function tryCreateServiceRoleClient():
  | { client: SupabaseClient; error: null }
  | { client: null; error: string } {
  const configError = getServiceRoleConfigError();
  if (configError) {
    return { client: null, error: configError };
  }

  try {
    return { client: createServiceRoleClient(), error: null };
  } catch (e) {
    return {
      client: null,
      error: e instanceof Error ? e.message : "Failed to connect to Supabase.",
    };
  }
}
