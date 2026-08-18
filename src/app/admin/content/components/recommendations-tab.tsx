"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createRecommendedMedia,
  createRecommendedRecipe,
  deleteRecommendedMedia,
  deleteRecommendedRecipe,
  updateRecommendedMedia,
  updateRecommendedRecipe,
  type RecommendationActionResult,
} from "../recommendation-actions";
import type { AdminData } from "../types";
import {
  CONTENT_TRACKS,
  MEDIA_TYPES,
  RECIPE_DIFFICULTIES,
  contentTrackLabel,
  mediaTypeLabel,
  recipeDifficultyLabel,
  type RecommendedMedia,
  type RecommendedRecipe,
} from "@/lib/community/recommendation-types";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
  secondaryButtonClass,
} from "./ui";

const initialState: RecommendationActionResult = {};

function ActiveCheckbox({ defaultChecked = true }: { defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700">
      <input type="hidden" name="is_active" value="false" />
      <input
        name="is_active"
        type="checkbox"
        value="true"
        defaultChecked={defaultChecked}
        className="rounded"
      />
      Active
    </label>
  );
}

function TrackSelect({ defaultValue = "adult" }: { defaultValue?: string }) {
  return (
    <select name="content_track" defaultValue={defaultValue} className={inputClass} required>
      {CONTENT_TRACKS.map((track) => (
        <option key={track} value={track}>
          {contentTrackLabel(track)}
        </option>
      ))}
    </select>
  );
}

export function RecommendationsTab({ data }: { data: AdminData }) {
  const [createMediaState, createMediaAction, createMediaPending] = useActionState(
    createRecommendedMedia,
    initialState
  );
  const [createRecipeState, createRecipeAction, createRecipePending] = useActionState(
    createRecommendedRecipe,
    initialState
  );
  const [editingMediaId, setEditingMediaId] = useState<string | null>(null);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-8">
      <SectionCard title="Add movie or book">
        <form action={createMediaAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Title</label>
              <input name="title" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Creator (director / author)</label>
              <input name="creator" className={inputClass} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Type</label>
              <select name="media_type" defaultValue="movie" className={inputClass} required>
                {MEDIA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {mediaTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Track</label>
              <TrackSelect />
            </div>
            <div>
              <label className={labelClass}>CEFR level</label>
              <input name="cefr_level" placeholder="A2, B1…" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea name="description" rows={3} className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Where to find</label>
              <input name="where_to_find" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Age note</label>
              <input name="age_appropriate_note" className={inputClass} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Display order</label>
              <input name="display_order" type="number" min={0} defaultValue={0} className={inputClass} />
            </div>
            <div className="flex items-end">
              <ActiveCheckbox />
            </div>
          </div>
          <FormMessage state={createMediaState} />
          <button type="submit" disabled={createMediaPending} className={buttonClass}>
            {createMediaPending ? "Saving…" : "Add media"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Movies & books (${data.recommendedMedia.length})`}>
        {data.recommendedMedia.length === 0 ? (
          <p className="text-sm text-zinc-500">No media recommendations yet.</p>
        ) : (
          <div className="space-y-4">
            {data.recommendedMedia.map((item) =>
              editingMediaId === item.id ? (
                <MediaEditForm
                  key={item.id}
                  item={item}
                  onCancel={() => setEditingMediaId(null)}
                  onSaved={() => {
                    setEditingMediaId(null);
                    router.refresh();
                  }}
                />
              ) : (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">{item.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {mediaTypeLabel(item.media_type)} · {contentTrackLabel(item.content_track)}
                        {item.is_active ? "" : " · Inactive"}
                      </p>
                      {item.creator ? (
                        <p className="mt-1 text-sm text-zinc-600">{item.creator}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingMediaId(item.id)}
                        className={secondaryButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={dangerButtonClass}
                        onClick={async () => {
                          if (!confirm("Delete this recommendation?")) return;
                          await deleteRecommendedMedia(item.id);
                          router.refresh();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Add recipe">
        <form action={createRecipeAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Title</label>
              <input name="title" required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Punjabi name</label>
              <input name="punjabi_name" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea name="description" rows={3} className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Difficulty</label>
              <select name="difficulty" defaultValue="" className={inputClass}>
                <option value="">Not set</option>
                {RECIPE_DIFFICULTIES.map((value) => (
                  <option key={value} value={value}>
                    {recipeDifficultyLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Prep time (minutes)</label>
              <input name="prep_time_minutes" type="number" min={0} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Track</label>
              <TrackSelect />
            </div>
          </div>
          <div>
            <label className={labelClass}>External link</label>
            <input name="external_link" type="url" className={inputClass} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Display order</label>
              <input name="display_order" type="number" min={0} defaultValue={0} className={inputClass} />
            </div>
            <div className="flex items-end">
              <ActiveCheckbox />
            </div>
          </div>
          <FormMessage state={createRecipeState} />
          <button type="submit" disabled={createRecipePending} className={buttonClass}>
            {createRecipePending ? "Saving…" : "Add recipe"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Recipes (${data.recommendedRecipes.length})`}>
        {data.recommendedRecipes.length === 0 ? (
          <p className="text-sm text-zinc-500">No recipes yet.</p>
        ) : (
          <div className="space-y-4">
            {data.recommendedRecipes.map((item) =>
              editingRecipeId === item.id ? (
                <RecipeEditForm
                  key={item.id}
                  item={item}
                  onCancel={() => setEditingRecipeId(null)}
                  onSaved={() => {
                    setEditingRecipeId(null);
                    router.refresh();
                  }}
                />
              ) : (
                <div key={item.id} className="rounded-xl border border-zinc-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-900">{item.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {contentTrackLabel(item.content_track)}
                        {item.difficulty ? ` · ${recipeDifficultyLabel(item.difficulty)}` : ""}
                        {item.is_active ? "" : " · Inactive"}
                      </p>
                      {item.punjabi_name ? (
                        <p className="mt-1 text-sm text-zinc-600">{item.punjabi_name}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingRecipeId(item.id)}
                        className={secondaryButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={dangerButtonClass}
                        onClick={async () => {
                          if (!confirm("Delete this recipe?")) return;
                          await deleteRecommendedRecipe(item.id);
                          router.refresh();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function MediaEditForm({
  item,
  onCancel,
  onSaved,
}: {
  item: RecommendedMedia;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateRecommendedMedia, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <input type="hidden" name="id" value={item.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Title</label>
          <input name="title" required defaultValue={item.title} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Creator</label>
          <input name="creator" defaultValue={item.creator ?? ""} className={inputClass} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Type</label>
          <select name="media_type" defaultValue={item.media_type} className={inputClass} required>
            {MEDIA_TYPES.map((type) => (
              <option key={type} value={type}>
                {mediaTypeLabel(type)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Track</label>
          <TrackSelect defaultValue={item.content_track} />
        </div>
        <div>
          <label className={labelClass}>CEFR level</label>
          <input name="cefr_level" defaultValue={item.cefr_level ?? ""} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea name="description" rows={3} defaultValue={item.description ?? ""} className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Where to find</label>
          <input name="where_to_find" defaultValue={item.where_to_find ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Age note</label>
          <input
            name="age_appropriate_note"
            defaultValue={item.age_appropriate_note ?? ""}
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Display order</label>
          <input
            name="display_order"
            type="number"
            min={0}
            defaultValue={item.display_order}
            className={inputClass}
          />
        </div>
        <div className="flex items-end">
          <ActiveCheckbox defaultChecked={item.is_active} />
        </div>
      </div>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function RecipeEditForm({
  item,
  onCancel,
  onSaved,
}: {
  item: RecommendedRecipe;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(updateRecommendedRecipe, initialState);

  useEffect(() => {
    if (state.success) onSaved();
  }, [state.success, onSaved]);

  return (
    <form action={action} className="space-y-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
      <input type="hidden" name="id" value={item.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Title</label>
          <input name="title" required defaultValue={item.title} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Punjabi name</label>
          <input name="punjabi_name" defaultValue={item.punjabi_name ?? ""} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea name="description" rows={3} defaultValue={item.description ?? ""} className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Difficulty</label>
          <select name="difficulty" defaultValue={item.difficulty ?? ""} className={inputClass}>
            <option value="">Not set</option>
            {RECIPE_DIFFICULTIES.map((value) => (
              <option key={value} value={value}>
                {recipeDifficultyLabel(value)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Prep time (minutes)</label>
          <input
            name="prep_time_minutes"
            type="number"
            min={0}
            defaultValue={item.prep_time_minutes ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Track</label>
          <TrackSelect defaultValue={item.content_track} />
        </div>
      </div>
      <div>
        <label className={labelClass}>External link</label>
        <input
          name="external_link"
          type="url"
          defaultValue={item.external_link ?? ""}
          className={inputClass}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Display order</label>
          <input
            name="display_order"
            type="number"
            min={0}
            defaultValue={item.display_order}
            className={inputClass}
          />
        </div>
        <div className="flex items-end">
          <ActiveCheckbox defaultChecked={item.is_active} />
        </div>
      </div>
      <FormMessage state={state} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  );
}
