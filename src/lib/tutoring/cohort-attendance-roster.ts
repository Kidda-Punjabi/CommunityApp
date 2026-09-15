export type CohortRosterSourceRow = {
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

function applyMemberOverlay(
  userIds: Set<string>,
  kidIds: Set<string>,
  members: CohortRosterSourceRow[]
) {
  for (const row of members) {
    if (row.userId) {
      if (row.leftAt == null) userIds.add(row.userId);
      else userIds.delete(row.userId);
    }
    if (row.kidProfileId) {
      if (row.leftAt == null) kidIds.add(row.kidProfileId);
      else kidIds.delete(row.kidProfileId);
    }
  }
}

/**
 * Build the attendance/homework roster.
 *
 * Kids courses never list parent accounts. Parent-only membership rows are
 * resolved to the kid profiles linked to that parent.
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
      continue;
    }
    addActor(rosterUserIds, rosterKidIds, row);
  }

  if (!options.isKidsCourse) {
    return { rosterUserIds, rosterKidIds, activeUserIds, activeKidIds };
  }

  const parentIds = new Set<string>([...rosterUserIds, ...activeUserIds]);
  for (const parentId of parentIds) {
    for (const kidId of options.kidsByParentUserId.get(parentId) ?? []) {
      rosterKidIds.add(kidId);
      if (activeUserIds.has(parentId)) activeKidIds.add(kidId);
    }
  }

  rosterUserIds.clear();
  activeUserIds.clear();

  return { rosterUserIds, rosterKidIds, activeUserIds, activeKidIds };
}
