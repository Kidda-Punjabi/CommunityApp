import type { AppRole } from "@/lib/auth/admin-access";

export type ForumContentStatus =
  | "visible"
  | "hidden"
  | "removed"
  | "deleted"
  | "hidden_pending_review";
export type ForumReportStatus = "open" | "dismissed" | "actioned";

export type ForumPollView = {
  id: string;
  question: string;
  closesAt: string | null;
  allowMultiple: boolean;
  closed: boolean;
  totalVotes: number;
  viewerOptionIds: string[];
  options: { id: string; label: string; votes: number; position: number }[];
};

export type ForumAuthor = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  staffRoles: AppRole[];
};

export type ForumPostSummary = {
  id: string;
  title: string;
  category: string | null;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  editedAt: string | null;
  author: ForumAuthor;
  likedByViewer: boolean;
  bodySnippet?: string;
};

export type ForumPostDetail = ForumPostSummary & {
  body: string;
};

export type ForumPostPreview = ForumPostSummary & {
  bodySnippet: string;
};

export type ForumReply = {
  id: string;
  body: string;
  createdAt: string;
  parentReplyId: string | null;
  author: ForumAuthor;
  likedByViewer: boolean;
  likeCount: number;
  children: ForumReply[];
};

export type ForumReportRow = {
  id: string;
  reason: string;
  createdAt: string;
  status: ForumReportStatus;
  targetType: "post" | "reply";
  targetId: string;
  targetPreview: string;
  reporterName: string;
};
