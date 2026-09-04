import "server-only";

export type PublicFormLink = {
  slug: string;
  formType: "quiz" | "feedback";
  targetId: string;
  label: string;
};

export async function lookupPublicFormLinkBySlug(
  slug: string
): Promise<PublicFormLink | null> {
  const trimmed = slug.trim();
  if (!trimmed || trimmed.length > 80) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;

  const endpoint = new URL("/rest/v1/public_form_links", url);
  endpoint.searchParams.set("slug", `eq.${trimmed}`);
  endpoint.searchParams.set("select", "slug,form_type,target_id,label");
  endpoint.searchParams.set("limit", "1");

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const rows = (await response.json()) as Array<{
      slug: string;
      form_type: string;
      target_id: string;
      label: string;
    }>;
    const data = rows[0];
    if (!data) return null;
    if (data.form_type !== "quiz" && data.form_type !== "feedback") return null;

    return {
      slug: data.slug,
      formType: data.form_type,
      targetId: data.target_id,
      label: data.label,
    };
  } catch {
    return null;
  }
}

export async function listPublicFormLinks(): Promise<PublicFormLink[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return [];

  const endpoint = new URL("/rest/v1/public_form_links", url);
  endpoint.searchParams.set("select", "slug,form_type,target_id,label");
  endpoint.searchParams.set("order", "form_type.asc,label.asc");
  endpoint.searchParams.set("limit", "100");

  try {
    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];

    const rows = (await response.json()) as Array<{
      slug: string;
      form_type: string;
      target_id: string;
      label: string;
    }>;

    return rows.flatMap((row) => {
      if (row.form_type !== "quiz" && row.form_type !== "feedback") return [];
      return [
        {
          slug: row.slug,
          formType: row.form_type,
          targetId: row.target_id,
          label: row.label,
        } satisfies PublicFormLink,
      ];
    });
  } catch {
    return [];
  }
}
