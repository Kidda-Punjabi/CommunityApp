import { HubCard } from "@/components/ui/hub-primitives";
import {
  contentTrackLabel,
  mediaTypeLabel,
  recipeDifficultyLabel,
  type TutorPickItem,
} from "@/lib/community/recommendation-types";

function kindLabel(item: TutorPickItem): string {
  if (item.kind === "recipe") return "Recipe";
  return item.mediaType ? mediaTypeLabel(item.mediaType) : "Media";
}

export function RecommendationPickCard({ item }: { item: TutorPickItem }) {
  return (
    <HubCard className="py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {kindLabel(item)} · {contentTrackLabel(item.contentTrack)}
      </p>
      <p className="mt-1 font-medium text-zinc-900">{item.title}</p>
      {item.punjabiName ? (
        <p className="mt-0.5 text-sm text-zinc-600">{item.punjabiName}</p>
      ) : null}
      {item.creator ? <p className="mt-0.5 text-sm text-zinc-600">{item.creator}</p> : null}
      {item.description ? (
        <p className="mt-2 text-sm text-zinc-600">{item.description}</p>
      ) : null}
      <div className="mt-2 space-y-1 text-sm text-zinc-500">
        {item.cefrLevel ? <p>Level: {item.cefrLevel}</p> : null}
        {item.whereToFind ? <p>Where to find: {item.whereToFind}</p> : null}
        {item.ageAppropriateNote ? <p>{item.ageAppropriateNote}</p> : null}
        {item.difficulty ? <p>Difficulty: {recipeDifficultyLabel(item.difficulty)}</p> : null}
        {item.prepTimeMinutes != null ? <p>Prep: {item.prepTimeMinutes} min</p> : null}
        {item.externalLink ? (
          <p>
            <a
              href={item.externalLink}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-violet-600 hover:text-violet-500"
            >
              Open recipe
            </a>
          </p>
        ) : null}
      </div>
      {item.note ? (
        <p className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-900">
          Tutor note: {item.note}
        </p>
      ) : null}
    </HubCard>
  );
}
