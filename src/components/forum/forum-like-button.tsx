"use client";

import { useState, useTransition } from "react";
import { toggleForumPostLike, toggleForumReplyLike } from "@/app/dashboard/community/forum/actions";

type ForumLikeButtonProps = {
  targetType: "post" | "reply";
  targetId: string;
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  size?: "sm" | "md";
};

export function ForumLikeButton({
  targetType,
  targetId,
  postId,
  initialLiked,
  initialCount,
  size = "md",
}: ForumLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const nextLiked = !liked;
    const nextCount = Math.max(0, count + (nextLiked ? 1 : -1));
    setLiked(nextLiked);
    setCount(nextCount);

    startTransition(async () => {
      const result =
        targetType === "post"
          ? await toggleForumPostLike(targetId)
          : await toggleForumReplyLike(targetId, postId);

      if (result.error) {
        setLiked(liked);
        setCount(count);
      }
    });
  }

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-colors disabled:opacity-60 ${
        liked
          ? "bg-violet-100 text-violet-700"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.75}
        className={iconSize}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
        />
      </svg>
      <span>{count}</span>
    </button>
  );
}
