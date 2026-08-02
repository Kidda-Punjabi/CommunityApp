import { PictureMatchGame } from "@/components/games/PictureMatch/PictureMatchGame";
import { fetchPersonalBest } from "@/lib/games/game-scores";
import { loadPictureMatchCards } from "@/lib/games/load-picture-match";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PictureMatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [best, pictureMatch] = await Promise.all([
    fetchPersonalBest(supabase, user.id, "picture_match"),
    loadPictureMatchCards(supabase, user.id),
  ]);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <PictureMatchGame
        initialBestScore={best ?? 0}
        initialCards={pictureMatch.cards}
        initialLoadError={pictureMatch.loadError}
      />
    </div>
  );
}
