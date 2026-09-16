import type { NotionSyncRunOutcome, NotionSyncRunSteps } from "@/lib/notion/sync-run";

export type SyncHealthWatermark = {
  id: "leadsCache" | "packages" | "lessonLog";
  label: string;
  lastEditedTime: string | null;
  savedAt: string | null;
};

export type SyncHealthLastRun = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  outcome: NotionSyncRunOutcome;
  skippedOverlap: boolean;
  steps: NotionSyncRunSteps;
  error: string | null;
};

export type SyncHealthLessonError = {
  id: string;
  notionPageId: string | null;
  title: string | null;
  lessonDate: string | null;
  error: string | null;
  syncedAt: string | null;
};

export type SyncHealthFailure = {
  notionPageId: string;
  lastEditedTime: string | null;
  error: string | null;
  retryCount: number;
  lastFailedAt: string;
};

export type SyncHealthConflict = {
  id: string;
  profileId: string;
  person: string;
  email: string | null;
  reason: string;
  stuckSince: string;
};

export type SyncHealthGrantQueue = {
  id: string;
  profileId: string | null;
  person: string;
  email: string | null;
  reason: string;
  stuckSince: string;
};

export type SyncHealthLock = {
  held: boolean;
  holder: string | null;
  acquiredAt: string | null;
  expiresAt: string | null;
};

export type SyncHealthSnapshot = {
  lastRun: SyncHealthLastRun | null;
  watermarks: SyncHealthWatermark[];
  lock: SyncHealthLock;
  lessonErrors: SyncHealthLessonError[];
  failures: SyncHealthFailure[];
  conflicts: SyncHealthConflict[];
  grantQueue: SyncHealthGrantQueue[];
  error?: string;
};
