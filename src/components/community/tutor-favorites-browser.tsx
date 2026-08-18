"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setTutorFavorite, type FavoriteActionResult } from "@/app/dashboard/community/favorites/actions";
import { HubCard } from "@/components/ui/hub-primitives";
import {
  contentTrackLabel,
  mediaTypeLabel,
  recipeDifficultyLabel,
  type RecommendedMedia,
  type RecommendedRecipe,
  type TutorFavoriteRow,
} from "@/lib/community/recommendation-types";
import { ui } from "@/lib/ui/styles";

const initial: FavoriteActionResult = {};

function FavoriteItemForm({
  mediaId,
  recipeId,
  title,
  meta,
  description,
  existing,
}: {
  mediaId?: string;
  recipeId?: string;
  title: string;
  meta: string;
  description?: string | null;
  existing: TutorFavoriteRow | undefined;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(setTutorFavorite, initial);
  const [note, setNote] = useState(existing?.note ?? "");
  const favorited = Boolean(existing);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <HubCard className="py-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{meta}</p>
        <p className="mt-1 font-medium text-zinc-900">{title}</p>
        {description ? (
          <p className="mt-1 line-clamp-3 text-sm text-zinc-600">{description}</p>
        ) : null}
      </div>

      <form action={action} className="mt-3 space-y-3">
        {mediaId ? <input type="hidden" name="media_id" value={mediaId} /> : null}
        {recipeId ? <input type="hidden" name="recipe_id" value={recipeId} /> : null}
        <label className="block text-sm font-medium text-zinc-700">
          Short note (optional)
          <textarea
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={280}
            rows={2}
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" name="favorited" value="true" disabled={pending} className={ui.btnPrimary}>
            {pending ? "Saving…" : favorited ? "Save note" : "Add to my favorites"}
          </button>
          {favorited ? (
            <button
              type="submit"
              name="favorited"
              value="false"
              disabled={pending}
              className="inline-flex items-center justify-center rounded-full border border-red-200 px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          ) : null}
        </div>
        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? <p className="text-sm text-green-700">{state.success}</p> : null}
      </form>
    </HubCard>
  );
}

export function TutorFavoritesBrowser({
  media,
  recipes,
  favorites,
}: {
  media: RecommendedMedia[];
  recipes: RecommendedRecipe[];
  favorites: TutorFavoriteRow[];
}) {
  const favoriteByMedia = new Map(
    favorites.filter((row) => row.media_id).map((row) => [row.media_id as string, row])
  );
  const favoriteByRecipe = new Map(
    favorites.filter((row) => row.recipe_id).map((row) => [row.recipe_id as string, row])
  );

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Movies & books</h2>
        {media.length === 0 ? (
          <p className="text-sm text-zinc-500">No active media recommendations yet.</p>
        ) : (
          <div className="space-y-3">
            {media.map((item) => (
              <FavoriteItemForm
                key={item.id}
                mediaId={item.id}
                title={item.title}
                description={item.description}
                meta={`${mediaTypeLabel(item.media_type)} · ${contentTrackLabel(item.content_track)}`}
                existing={favoriteByMedia.get(item.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-zinc-900">Recipes</h2>
        {recipes.length === 0 ? (
          <p className="text-sm text-zinc-500">No active recipes yet.</p>
        ) : (
          <div className="space-y-3">
            {recipes.map((item) => (
              <FavoriteItemForm
                key={item.id}
                recipeId={item.id}
                title={item.title}
                description={item.description}
                meta={`Recipe · ${contentTrackLabel(item.content_track)}${
                  item.difficulty ? ` · ${recipeDifficultyLabel(item.difficulty)}` : ""
                }`}
                existing={favoriteByRecipe.get(item.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
