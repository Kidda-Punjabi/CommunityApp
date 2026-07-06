import { SoundSettingsForm } from "@/components/audio/sound-settings-form";
import { loadSoundSettings } from "@/lib/audio/load-sound-settings";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SoundSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const initialSettings = await loadSoundSettings(supabase, user.id);

  return <SoundSettingsForm initialSettings={initialSettings} />;
}
