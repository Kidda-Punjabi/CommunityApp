import type { ConversationCharacter } from "@/lib/conversation/types";

const ICON_EMOJI: Record<string, string> = {
  store: "🏪",
  shop: "🏪",
  person: "🧑",
};

type ConversationBubbleProps = {
  character: ConversationCharacter;
  gurmukhi: string;
  romanised?: string | null;
  english?: string | null;
  align?: "left" | "right";
};

export function ConversationBubble({
  character,
  gurmukhi,
  romanised,
  english,
  align = "left",
}: ConversationBubbleProps) {
  const emoji = character.icon_name ? (ICON_EMOJI[character.icon_name] ?? "💬") : "💬";

  return (
    <div className={`flex gap-3 ${align === "right" ? "flex-row-reverse" : ""}`}>
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-lg"
        aria-hidden="true"
      >
        {character.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={character.avatar_url}
            alt=""
            className="h-full w-full rounded-full object-cover"
          />
        ) : (
          emoji
        )}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          align === "right"
            ? "rounded-tr-sm bg-violet-600 text-white"
            : "rounded-tl-sm border border-zinc-200 bg-white shadow-sm"
        }`}
      >
        <p className="text-xs font-medium text-violet-600">{character.name}</p>
        <p
          className={`mt-1 text-base font-semibold leading-relaxed ${
            align === "right" ? "text-white" : "text-zinc-900"
          }`}
        >
          {gurmukhi}
        </p>
        {romanised ? (
          <p
            className={`mt-1 text-sm ${
              align === "right" ? "text-violet-100" : "text-violet-600"
            }`}
          >
            {romanised}
          </p>
        ) : null}
        {english ? (
          <p
            className={`mt-1 text-sm ${
              align === "right" ? "text-violet-100" : "text-zinc-500"
            }`}
          >
            {english}
          </p>
        ) : null}
      </div>
    </div>
  );
}
