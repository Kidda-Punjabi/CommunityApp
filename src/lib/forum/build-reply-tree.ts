import type { ForumReply } from "./types";

/** Build a nested reply tree from a flat list (preserves arbitrary depth). */
export function buildReplyTree(flatReplies: ForumReply[]): ForumReply[] {
  const byId = new Map(flatReplies.map((reply) => [reply.id, { ...reply, children: [] as ForumReply[] }]));
  const roots: ForumReply[] = [];

  for (const reply of byId.values()) {
    if (reply.parentReplyId && byId.has(reply.parentReplyId)) {
      byId.get(reply.parentReplyId)!.children.push(reply);
    } else {
      roots.push(reply);
    }
  }

  return roots;
}
