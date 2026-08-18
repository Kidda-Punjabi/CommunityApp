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

export type LoadScopedFlashcardOptions = {
  eq?: Record<string, string>;
  /** Postgres array overlap (`&&`) — matches the tag anywhere in topic_tags. */
  overlaps?: Record<string, string[]>;
  orderBy?: { column: string; ascending?: boolean };
  scope?: GamesContentScope;
};

/** PostgREST default max-rows is 1000; page to avoid silently truncating the pool. */
const FLASHCARD_PAGE_SIZE = 1000;

/**
 * Load flashcards for a game pool and apply Learn English / private-course scoping.
 * Always selects lesson_id so private-course cards can be excluded.
 */
export async function loadScopedFlashcardPoolRows<T extends FlashcardRowWithLesson>(
  supabase: SupabaseClient,
  userId: string,
  select: string,
  options?: LoadScopedFlashcardOptions
): Promise<{ rows: T[]; scope: GamesContentScope; error: string | null }> {
  const scope =
    options?.scope ?? (await resolveGamesContentScope(supabase, userId));

  // Ensure lesson_id is always available for scoping even if callers omit it.
  const selectCols = select.includes("lesson_id")
    ? select
    : `${select}, lesson_id`;

  const pages: T[] = [];
  let from = 0;

  while (true) {
    let query = supabase.from("flashcards").select(selectCols);
    if (options?.eq) {
      for (const [key, value] of Object.entries(options.eq)) {
        query = query.eq(key, value);
      }
    }
    if (options?.overlaps) {
      for (const [key, value] of Object.entries(options.overlaps)) {
        if (value.length > 0) {
          query = query.overlaps(key, value);
        }
      }
    }
    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }

    const to = from + FLASHCARD_PAGE_SIZE - 1;
    const { data, error } = await query.range(from, to);
    if (error) {
      return { rows: [], scope, error: error.message };
    }

    const page = (data ?? []) as unknown as T[];
    pages.push(...page);
    if (page.length < FLASHCARD_PAGE_SIZE) break;
    from += FLASHCARD_PAGE_SIZE;
  }

  const rows = await filterFlashcardsForGamesScope(supabase, pages, scope);

  return { rows, scope, error: null };
}

export async function resolveScopeForUser(
  supabase: SupabaseClient,
  user: User | null
): Promise<GamesContentScope> {
  if (!user) return { mode: "public" };
  return resolveGamesContentScope(supabase, user.id);
}
