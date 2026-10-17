import { generateLevel1Samples } from "@/app/admin/community/placement-audio/actions";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { ui } from "@/lib/ui/styles";

export const maxDuration = 300;

export default async function PlacementAudioPage() {
  const admin = createServiceRoleClient();
  const { data: clips } = await admin
    .from("placement_test_audio")
    .select("id, item_id, option_id, voice_id, storage_path, approved")
    .order("item_id");
  const signed = await Promise.all(
    (clips ?? []).map(async (clip) => {
      const { data } = await admin.storage.from("placement-audio").createSignedUrl(clip.storage_path, 60 * 30);
      return { ...clip, url: data?.signedUrl ?? null };
    })
  );

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl font-bold text-zinc-900">Placement voices</h1>
      <p className="text-sm text-zinc-600">Level 1 samples only. Temporary voice until you pick one and a tutor approves the clips. Members still hear browser speech.</p>
      <form action={async () => {
        "use server";
        await generateLevel1Samples();
      }}>
        <button type="submit" className={ui.btnPrimary}>Generate Level 1 samples</button>
      </form>
      <ul className="space-y-3">
        {signed.map((clip) => (
          <li key={clip.id} className="rounded-2xl bg-white p-3">
            <p className="text-sm font-medium text-zinc-900">{clip.item_id} · {clip.option_id ?? "line"} · {clip.voice_id}</p>
            <p className="text-xs text-zinc-500">{clip.approved ? "Approved" : "Not approved"}</p>
            {clip.url ? <audio controls src={clip.url} className="mt-2 w-full" /> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
