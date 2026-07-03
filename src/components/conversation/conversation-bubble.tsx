import type { ConversationCharacter } from "@/lib/conversation/types";

const ICON_EMOJI: Record<string, string> = {
  store: "🏪",
  shop: "🏪",
  person: "🧑",
};

export type ConversationMessageRole = "npc" | "student";

type ConversationMessageBubbleProps = {
  role: ConversationMessageRole;
  character?: ConversationCharacter;
  gurmukhi: string;
  romanised?: string | null;
  english?: string | null;
};

export function ConversationMessageBubble({
  role,
  character,
  gurmukhi,
  romanised,
  english,
}: ConversationMessageBubbleProps) {
  if (role === "student") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-tr-sm bg-violet-600 px-4 py-3 shadow-sm">
          <p className="text-xs font-medium text-violet-200">You</p>
          <p className="mt-1 text-base font-semibold leading-relaxed text-white">{gurmukhi}</p>
          {romanised ? (
            <p className="mt-1 text-sm text-violet-100">{romanised}</p>
          ) : null}
          {english ? <p className="mt-1 text-sm text-violet-200/90">{english}</p> : null}
        </div>
      </div>
    );
  }

  const emoji = character?.icon_name
    ? (ICON_EMOJI[character.icon_name] ?? "💬")
    : "💬";

  return (
    <div className="flex gap-2.5 sm:gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-base sm:h-10 sm:w-10 sm:text-lg"
        aria-hidden="true"
      >
        {character?.avatar_url ? (
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
      <div className="max-w-[88%] rounded-2xl rounded-tl-sm border border-zinc-200 bg-white px-4 py-3 shadow-sm">
        {character?.name ? (
          <p className="text-xs font-medium text-violet-600">{character.name}</p>
        ) : null}
        <p className="mt-1 text-base font-semibold leading-relaxed text-zinc-900">{gurmukhi}</p>
        {romanised ? <p className="mt-1 text-sm text-violet-600">{romanised}</p> : null}
        {english ? <p className="mt-1 text-sm text-zinc-500">{english}</p> : null}
      </div>
    </div>
  );
}

/** @deprecated Use ConversationMessageBubble */
export function ConversationBubble({
  character,
  gurmukhi,
  romanised,
  english,
  align = "left",
}: {
  character: ConversationCharacter;
  gurmukhi: string;
  romanised?: string | null;
  english?: string | null;
  align?: "left" | "right";
}) {
  return (
    <ConversationMessageBubble
      role={align === "right" ? "student" : "npc"}
      character={character}
      gurmukhi={gurmukhi}
      romanised={romanised}
      english={english}
    />
  );
}
