export type PublicOption = { id: string; label: string; audioUrl: string | null };

export type PublicItem = {
  id: string;
  prompt: string;
  roman: string | null;
  audioUrl: string | null;
  options: PublicOption[];
  kind: "meaning" | "say" | "sound";
};
