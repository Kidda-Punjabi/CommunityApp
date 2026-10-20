export type CohortRosterSourceRow = {
  /** cohort_members.id when this row came from a membership. */
  memberId?: string | null;
  userId: string | null;
  kidProfileId: string | null;
  leftAt?: string | null;
};

export type CohortRosterActors = {
  rosterUserIds: Set<string>;
  rosterKidIds: Set<string>;
  activeUserIds: Set<string>;
  activeKidIds: Set<string>;
};

function addActor(
  userIds: Set<string>,
  kidIds: Set<string>,
  row: CohortRosterSourceRow
) {
  if (row.userId) userIds.add(row.userId);
  if (row.kidProfileId) kidIds.add(row.kidProfileId);
}

function dedupedMembers(members: CohortRosterSourceRow[]): CohortRosterSourceRow[] {
  const seen = new Set<string>();
  const rows: CohortRosterSourceRow[] = [];
  for (const row of members) {
    if (row.memberId) {
      if (seen.has(row.memberId)) continue;
      seen.add(row.memberId);
    }
    rows.push(row);
  }
  return rows;
}

function applyMemberOverlay(
  userIds: Set<string>,
  kidIds: Set<string>,
  members: CohortRosterSourceRow[]
) {
  for (const row of dedupedMembers(members)) {
    // One membership row is one person. A kid row wins when both ids are set.
    if (row.kidProfileId) {
      if (row.leftAt == null) kidIds.add(row.kidProfileId);
      else kidIds.delete(row.kidProfileId);
      continue;
    }
    if (row.userId) {
      if (row.leftAt == null) userIds.add(row.userId);
      else userIds.delete(row.userId);
    }
  }
}

/**
 * Build the attendance/homework roster.
 *
 * Kids courses still hide a parent account when that user has kid profiles,
 * and those profiles are listed instead. An active member row with only
 * user_id (an own-account student) stays on the roster under that user.
 */
export function resolveCohortRosterActors(options: {
  isKidsCourse: boolean;
  members: CohortRosterSourceRow[];
  enrollments: CohortRosterSourceRow[];
  extraActors?: CohortRosterSourceRow[];
  kidsByParentUserId: Map<string, string[]>;
}): CohortRosterActors {
  const activeUserIds = new Set<string>();
  const activeKidIds = new Set<string>();

  for (const row of options.enrollments) {
    addActor(activeUserIds, activeKidIds, row);
  }

  if (options.members.length > 0) {
    applyMemberOverlay(activeUserIds, activeKidIds, options.members);
  }

  const rosterUserIds = new Set(activeUserIds);
  const rosterKidIds = new Set(activeKidIds);

  for (const row of options.extraActors ?? []) {
    if (options.isKidsCourse) {
      if (row.kidProfileId) rosterKidIds.add(row.kidProfileId);
      else if (
        row.userId &&
        (options.kidsByParentUserId.get(row.userId) ?? []).length === 0
      ) {
        rosterUserIds.add(row.userId);
      }
      continue;
    }
    addActor(rosterUserIds, rosterKidIds, row);
  }

  if (!options.isKidsCourse) {
    return { rosterUserIds, rosterKidIds, activeUserIds, activeKidIds };
  }

  const parentIds = new Set<string>([...rosterUserIds, ...activeUserIds]);
  for (const parentId of parentIds) {
    const kidIds = options.kidsByParentUserId.get(parentId) ?? [];
    if (kidIds.length === 0) continue;
    for (const kidId of kidIds) {
      rosterKidIds.add(kidId);
      if (activeUserIds.has(parentId)) activeKidIds.add(kidId);
    }
    rosterUserIds.delete(parentId);
    activeUserIds.delete(parentId);
  }

  return { rosterUserIds, rosterKidIds, activeUserIds, activeKidIds };
}
