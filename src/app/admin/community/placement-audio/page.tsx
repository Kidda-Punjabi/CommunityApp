import { approvePlacementClip, generatePlacementAudio } from "@/app/admin/community/placement-audio/actions";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function PlacementAudioPage() {
  const admin = createServiceRoleClient();
  const [{ data: items }, { data: clips }] = await Promise.all([
    admin.from("placement_test_items").select("id, level, gurmukhi, options").order("level").order("sort_order"),
    admin.from("placement_test_audio").select("id, item_id, option_id, storage_path, approved, voice_id").order("item_id"),
  ]);
  const signed = await Promise.all(
    (clips ?? []).map(async (clip) => {
      const { data } = await admin.storage.from("placement-audio").createSignedUrl(clip.storage_path, 60 * 30);
      return { ...clip, url: data?.signedUrl ?? null };
    })
  );
  const byItem = new Map<string, typeof signed>();
  for (const clip of signed) {
    const list = byItem.get(clip.item_id) ?? [];
    list.push(clip);
    byItem.set(clip.item_id, list);
  }

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-zinc-900">Placement audio</h1>
      <p className="text-sm text-zinc-600">Lesson voice, Gurmukhi. Members hear the generated clip. Approve a clip once you have listened.</p>
      <form action={async () => { "use server"; await generatePlacementAudio(); }}>
        <button type="submit" className={ui.btnPrimary}>Generate all clips</button>
      </form>
      <ul className="space-y-3">
        {(items ?? []).map((item) => (
          <li key={item.id} className="rounded-2xl bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-900">Level {item.level} · {item.id}</p>
              <form action={async () => { "use server"; await generatePlacementAudio(item.id); }}>
                <button type="submit" className="min-h-11 text-sm font-semibold text-violet-700">Regenerate</button>
              </form>
            </div>
            <ul className="mt-2 space-y-2">
              {(byItem.get(item.id) ?? []).map((clip) => (
                <li key={clip.id} className="rounded-xl bg-zinc-50 p-2">
                  <p className="text-xs text-zinc-500">{clip.option_id} · {clip.approved ? "Approved" : "Generated"}</p>
                  {clip.url ? <audio controls src={clip.url} className="mt-1 w-full" /> : null}
                  <form action={async () => { "use server"; await approvePlacementClip(clip.id, !clip.approved); }}>
                    <button type="submit" className="mt-1 min-h-11 text-sm font-semibold text-violet-700">{clip.approved ? "Unapprove" : "Approve"}</button>
                  </form>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}