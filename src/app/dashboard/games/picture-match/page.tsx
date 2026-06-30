import { PictureMatchGame } from "@/components/games/PictureMatch/PictureMatchGame";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import { createClient } from "@/lib/supabase/server";

export default async function PictureMatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const best = user
    ? await fetchPersonalBest(supabase, user.id, "picture_match")
    : null;

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <PictureMatchGame initialBestScore={best ?? 0} />
    </div>
  );
}
