import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 1000;

type OrderSpec = { column: string; ascending?: boolean };

/**
 * Paginate through Supabase reads (PostgREST defaults to 1000 rows max per request).
 */
export async function fetchAllRows<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  order: OrderSpec[] = []
): Promise<{ data: T[]; error: PostgrestError | null }> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from(table).select(select);
    for (const spec of order) {
      query = query.order(spec.column, { ascending: spec.ascending ?? true });
    }

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };

    const page = (data ?? []) as unknown as T[];
    rows.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { data: rows, error: null };
}
