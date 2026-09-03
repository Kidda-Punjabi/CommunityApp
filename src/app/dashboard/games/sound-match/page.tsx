import { SoundMatchMode } from "@/components/games/sound-match-mode";
import { loadSoundMatchLetters } from "@/lib/games/load-sound-match";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SoundMatchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { letters, loadError } = await loadSoundMatchLetters(supabase);

  return (
    <div className="flex flex-1 flex-col px-4 py-6">
      <SoundMatchMode letters={letters} loadError={loadError} />
    </div>
  );
}
