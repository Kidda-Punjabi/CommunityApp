"use client";

import { useMemo, useState } from "react";
import { ForumPostCard } from "@/components/forum/forum-post-card";
import { FORUM_INTRO_CATEGORY } from "@/lib/forum/access";
import type { ForumPostSummary } from "@/lib/forum/types";
import { ui } from "@/lib/ui/styles";

type ForumFeedProps = {
  posts: ForumPostSummary[];
};

type ForumFilter = "all" | "introductions";

export function ForumFeed({ posts }: ForumFeedProps) {
  const [filter, setFilter] = useState<ForumFilter>("all");

  const filtered = useMemo(() => {
    if (filter === "introductions") {
      return posts.filter((post) => post.category === FORUM_INTRO_CATEGORY);
    }
    return posts;
  }, [filter, posts]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={
            filter === "all"
              ? ui.pillActive
              : ui.pillInactive
          }
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilter("introductions")}
          className={
            filter === "introductions"
              ? ui.pillActive
              : ui.pillInactive
          }
        >
          Introductions
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className={`${ui.emptyState} py-10`}>
          <p className="text-sm text-zinc-600">No introduction posts yet.</p>
        </div>
      ) : (
        <div className={ui.stack}>
          {filtered.map((post) => (
            <ForumPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
