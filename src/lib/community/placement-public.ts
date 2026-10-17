export type PublicOption = { id: string; label: string; speak: string | null };

export type PublicItem = {
  id: string;
  prompt: string;
  roman: string | null;
  speak: string | null;
  options: PublicOption[];
  kind: "meaning" | "say" | "sound";
};
