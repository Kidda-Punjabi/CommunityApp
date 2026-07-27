import {
  computeAppOnboardingMilestones,
  appOnboardingProgress,
  isAppOnboardingComplete,
} from "@/lib/admin/app-onboarding/milestones";
import type {
  AdminAppOnboardingRow,
  AdminAppOnboardingSummary,
  AppOnboardingFilter,
} from "@/lib/admin/app-onboarding/types";
import { getDisplayName } from "@/lib/profile/display-name";
import type { SupabaseClient, User } from "@supabase/supabase-js";

type ProfileRow = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  avatar_url: string | null;
  placement_completed_at: string | null;
  learner_level: number | null;
  created_at: string;
};

const PER_PAGE = 50;
const MAX_AUTH_PAGES = 50;

async function loadAllAuthUsers(supabase: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= MAX_AUTH_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function loadPracticedUserIds(
  supabase: SupabaseClient,
  userIds: string[]
): Promise<Set<string>> {
  const practiced = new Set<string>();
  if (userIds.length === 0) return practiced;

  const chunkSize = 200;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const [{ data: gameRows }, { data: quizRows }, { data: masteryRows }] = await Promise.all([
      supabase.from("game_scores").select("user_id").in("user_id", chunk),
      supabase.from("quiz_progress").select("user_id").in("user_id", chunk),
      supabase
        .from("topic_mastery")
        .select("user_id, mastery_level, depth")
        .in("user_id", chunk),
    ]);

    for (const row of gameRows ?? []) practiced.add(row.user_id as string);
    for (const row of quizRows ?? []) practiced.add(row.user_id as string);
    for (const row of masteryRows ?? []) {
      const masteryLevel = Number(row.mastery_level) || 0;
      const depth = Number(row.depth) || 0;
      if (masteryLevel > 0 || depth > 0) {
        practiced.add(row.user_id as string);
      }
    }
  }

  return practiced;
}

function emptySummary(): AdminAppOnboardingSummary {
  return { totalCount: 0, inProgressCount: 0, completeCount: 0 };
}

function buildRow(
  authUser: User,
  profile: ProfileRow | undefined,
  practicedIds: Set<string>
): AdminAppOnboardingRow {
  const profileSnapshot = profile ?? {
    full_name: null,
    preferred_name: null,
    avatar_url: null,
    placement_completed_at: null,
  };

  const milestones = computeAppOnboardingMilestones({
    hasAccount: true,
    emailConfirmedAt: authUser.email_confirmed_at,
    profile: profileSnapshot,
    practiced: practicedIds.has(authUser.id),
  });

  const { done, total } = appOnboardingProgress(milestones);
  const isComplete = isAppOnboardingComplete(milestones);

  return {
    userId: authUser.id,
    email: authUser.email ?? null,
    displayName: getDisplayName(profile ?? null) ?? authUser.email ?? authUser.id.slice(0, 8),
    signedUpAt: authUser.created_at ?? profile?.created_at ?? new Date(0).toISOString(),
    learnerLevel: profile?.learner_level ?? null,
    milestones,
    progressDone: done,
    progressTotal: total,
    isComplete,
  };
}

function summarizeAllRows(rows: AdminAppOnboardingRow[]): AdminAppOnboardingSummary {
  const completeCount = rows.filter((row) => row.isComplete).length;
  return {
    totalCount: rows.length,
    inProgressCount: rows.length - completeCount,
    completeCount,
  };
}

export async function loadAdminAppOnboarding(
  supabase: SupabaseClient,
  options: {
    page?: number;
    query?: string;
    filter?: AppOnboardingFilter;
  } = {}
): Promise<{
  rows: AdminAppOnboardingRow[];
  summary: AdminAppOnboardingSummary;
  page: number;
  totalPages: number;
  hasMore: boolean;
  error?: string;
}> {
  const page = Math.max(1, options.page ?? 1);
  const filter = options.filter ?? "all";
  const sanitized = options.query?.trim().toLowerCase() ?? "";

  try {
    const authUsers = await loadAllAuthUsers(supabase);
    if (authUsers.length === 0) {
      return {
        rows: [],
        summary: emptySummary(),
        page: 1,
        totalPages: 1,
        hasMore: false,
      };
    }

    const userIds = authUsers.map((user) => user.id);

    const [{ data: profiles }, practicedIds] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, preferred_name, avatar_url, placement_completed_at, learner_level, created_at"
        )
        .in("id", userIds),
      loadPracticedUserIds(supabase, userIds),
    ]);

    const profileById = new Map((profiles ?? []).map((row) => [row.id, row as ProfileRow]));

    let rows = authUsers.map((authUser) =>
      buildRow(authUser, profileById.get(authUser.id), practicedIds)
    );

    if (sanitized.length >= 2) {
      const safeQuery = sanitized.replace(/[%_]/g, "");
      rows = rows.filter(
        (row) =>
          row.displayName.toLowerCase().includes(safeQuery) ||
          (row.email?.toLowerCase().includes(safeQuery) ?? false)
      );
    }

    const summary = summarizeAllRows(rows);

    if (filter === "complete") {
      rows = rows.filter((row) => row.isComplete);
    } else if (filter === "in_progress") {
      rows = rows.filter((row) => !row.isComplete);
    }

    rows.sort((a, b) => {
      if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
      return b.signedUpAt.localeCompare(a.signedUpAt);
    });

    const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PER_PAGE;
    const pageRows = rows.slice(start, start + PER_PAGE);

    return {
      rows: pageRows,
      summary,
      page: safePage,
      totalPages,
      hasMore: safePage < totalPages,
    };
  } catch (error) {
    return {
      rows: [],
      summary: emptySummary(),
      page: 1,
      totalPages: 1,
      hasMore: false,
      error: error instanceof Error ? error.message : "Failed to load app onboarding.",
    };
  }
}
