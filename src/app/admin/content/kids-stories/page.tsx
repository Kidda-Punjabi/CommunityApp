import {
  createAdminKidBedtimeStory,
  deleteAdminKidBedtimeStory,
  listAdminKidBedtimeStories,
} from "@/app/admin/content/kids-stories-actions";
import {
  SectionCard,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
} from "@/app/admin/content/components/ui";

export default async function AdminKidsStoriesPage() {
  const { stories, error } = await listAdminKidBedtimeStories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-zinc-900">Kids bedtime stories</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Author stories here. Access is gated on the parent&apos;s Premium membership — do not
          seed curriculum content until Gurupma approves.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </p>
      ) : null}

      <SectionCard title="Add story">
        <form action={createAdminKidBedtimeStory} className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Title</span>
            <input name="title" required className={inputClass} placeholder="Story title" />
          </label>
          <label>
            <span className={labelClass}>Age tier</span>
            <select name="age_tier" className={inputClass} defaultValue="all">
              <option value="all">All ages</option>
              <option value="pre_reader">Pre-reader</option>
              <option value="early_reader">Early reader</option>
              <option value="independent">Independent</option>
            </select>
          </label>
          <label>
            <span className={labelClass}>Display order</span>
            <input name="display_order" type="number" defaultValue={0} className={inputClass} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Audio asset id (optional)</span>
            <input
              name="audio_asset_id"
              className={inputClass}
              placeholder="UUID from audio_assets"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 sm:col-span-2">
            <input name="is_premium" type="checkbox" defaultChecked className="rounded" />
            Premium-only (uncheck for free taste)
          </label>
          <button type="submit" className={buttonClass}>
            Create story
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Stories (${stories.length})`}>
        {stories.length === 0 ? (
          <p className="text-sm text-zinc-500">No stories yet.</p>
        ) : (
          <ul className="space-y-3">
            {stories.map((story) => (
              <li
                key={story.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 px-3 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-900">{story.title}</p>
                  <p className="text-xs text-zinc-500">
                    {story.age_tier} · order {story.display_order} ·{" "}
                    {story.is_premium ? "Premium" : "Free taste"}
                  </p>
                </div>
                <form action={deleteAdminKidBedtimeStory}>
                  <input type="hidden" name="id" value={story.id} />
                  <button type="submit" className={dangerButtonClass}>
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
