import type { ConversationCharacter } from "@/lib/conversation/types";

const ICON_EMOJI: Record<string, string> = {
  store: "🏪",
  shop: "🏪",
  person: "🧑",
  home: "🏠",
  medical: "🩺",
  grandmother: "👵",
};

export function getConversationCharacterEmoji(iconName?: string | null): string {
  if (!iconName) return "💬";
  return ICON_EMOJI[iconName] ?? "💬";
}

export type ConversationMessageRole = "npc" | "student";

type ConversationMessageBubbleProps = {
  role: ConversationMessageRole;
  character?: ConversationCharacter;
  gurmukhi: string;
  romanised?: string | null;
  english?: string | null;
  audioUrl?: string | null;
  isPlaying?: boolean;
  onPlay?: () => void;
};

export function ConversationMessageBubble({
  role,
  character,
  gurmukhi,
  romanised,
  english,
  audioUrl,
  isPlaying = false,
  onPlay,
}: ConversationMessageBubbleProps) {
  const canPlay = Boolean(onPlay && audioUrl?.trim());

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

  const emoji = getConversationCharacterEmoji(character?.icon_name);

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
      <button
        type="button"
        onClick={canPlay ? onPlay : undefined}
        disabled={!canPlay}
        className={`max-w-[88%] rounded-2xl rounded-tl-sm border px-4 py-3 text-left shadow-sm transition-colors ${
          isPlaying
            ? "border-violet-400 bg-violet-50"
            : canPlay
              ? "cursor-pointer border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/40"
              : "border-zinc-200 bg-white"
        }`}
        aria-label={canPlay ? "Play message audio" : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {character?.name ? (
              <p className="text-xs font-medium text-violet-600">{character.name}</p>
            ) : null}
            <p className="mt-1 text-base font-semibold leading-relaxed text-zinc-900">{gurmukhi}</p>
            {romanised ? <p className="mt-1 text-sm text-violet-600">{romanised}</p> : null}
            {english ? <p className="mt-1 text-sm text-zinc-500">{english}</p> : null}
            {canPlay ? (
              <p className="mt-1.5 text-xs text-zinc-400">Tap to listen</p>
            ) : null}
          </div>
          {canPlay ? (
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${
                isPlaying ? "bg-violet-600 text-white" : "bg-zinc-100 text-zinc-700"
              }`}
              aria-hidden="true"
            >
              {isPlaying ? "…" : "▶"}
            </span>
          ) : null}
        </div>
      </button>
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
