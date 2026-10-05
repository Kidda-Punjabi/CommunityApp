/** Fill lesson_id only where a log has none. Never replace a lesson the tutor already chose. */

export function assignMissingLessonIds(
  rows: Array<{ lessonId: string | null }>,
  lessonIdByNumber: Map<number, string>
): Array<{ index: number; lessonId: string }> {
  const used = new Set(rows.map((row) => row.lessonId).filter((id): id is string => Boolean(id)));
  const available = [...lessonIdByNumber.entries()].sort((a, b) => a[0] - b[0]);
  const updates: Array<{ index: number; lessonId: string }> = [];

  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index]?.lessonId) continue;
    const next = available.find(([, lessonId]) => !used.has(lessonId));
    if (!next) break;
    used.add(next[1]);
    updates.push({ index, lessonId: next[1] });
  }

  return updates;
}
