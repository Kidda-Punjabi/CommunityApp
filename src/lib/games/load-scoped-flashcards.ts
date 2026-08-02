import "server-only";

import {
  filterFlashcardsForGamesScope,
  resolveGamesContentScope,
  type GamesContentScope,
} from "@/lib/games/content-scope";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type FlashcardRowWithLesson = Record<string, unknown> & {
  lesson_id?: string | null;
};

/**
 * Load flashcards for a game pool and apply Learn English / private-course scoping.
 * Always selects lesson_id so private-course cards can be excluded.
 */
export async function loadScopedFlashcardPoolRows<T extends FlashcardRowWithLesson>(
  supabase: SupabaseClient,
  userId: string,
  select: string,
  options?: {
    eq?: Record<string, string>;
    orderBy?: { column: string; ascending?: boolean };
    scope?: GamesContentScope;
  }
): Promise<{ rows: T[]; scope: GamesContentScope; error: string | null }> {
  const scope =
    options?.scope ?? (await resolveGamesContentScope(supabase, userId));

  // Ensure lesson_id is always available for scoping even if callers omit it.
  const selectCols = select.includes("lesson_id")
    ? select
    : `${select}, lesson_id`;

  let query = supabase.from("flashcards").select(selectCols);
  if (options?.eq) {
    for (const [key, value] of Object.entries(options.eq)) {
      query = query.eq(key, value);
    }
  }
  if (options?.orderBy) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? true,
    });
  }

  const { data, error } = await query;
  if (error) {
    return { rows: [], scope, error: error.message };
  }

  const rows = await filterFlashcardsForGamesScope(
    supabase,
    (data ?? []) as unknown as T[],
    scope
  );

  return { rows, scope, error: null };
}

export async function resolveScopeForUser(
  supabase: SupabaseClient,
  user: User | null
): Promise<GamesContentScope> {
  if (!user) return { mode: "public" };
  return resolveGamesContentScope(supabase, user.id);
}
