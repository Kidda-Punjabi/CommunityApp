import { FORUM_INTRO_CATEGORY } from "@/lib/forum/access";

type ForumCategoryBadgeProps = {
  category: string;
};

export function ForumCategoryBadge({ category }: ForumCategoryBadgeProps) {
  if (category === FORUM_INTRO_CATEGORY) {
    return (
      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
        New member
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
      {category}
    </span>
  );
}
