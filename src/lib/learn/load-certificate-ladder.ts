import "server-only";

import { actorFilter, resolveCourseActor } from "@/lib/kids/course-actor";
import { MOCK_CERTIFICATES } from "@/lib/learn/certificate-mock";
import { LEARN_COURSE_LEVELS, type LearnCourseLevelId } from "@/lib/learn/course-levels";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CertificateLadderItem = {
  id: string;
  title: string;
  cefr: string;
  status: "earned" | "in_progress" | "locked";
  awardedOn: string | null;
  lockedHint: string | null;
  href: string | null;
};

type CertificateRow = {
  id: string;
  level: "beginner" | "intermediate" | "advanced";
  kid_level_number: number | null;
  issued_at: string;
};

const KID_LEVELS: Array<1 | 2 | 3> = [1, 2, 3];

function formatAwardedOn(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function stageTheme(id: LearnCourseLevelId) {
  return LEARN_COURSE_LEVELS[id];
}

function kidSlotsForStage(
  stage: "beginner" | "intermediate" | "advanced",
  rows: CertificateRow[],
  kidsCourseHref: string | null
): CertificateLadderItem[] {
  const theme = stageTheme(stage === "beginner" ? "beginners" : stage);
  const earnedByLevel = new Map(
    rows
      .filter((row) => row.level === stage && row.kid_level_number != null)
      .map((row) => [row.kid_level_number as number, row])
  );

  return KID_LEVELS.map((levelNumber) => {
    const earned = earnedByLevel.get(levelNumber) ?? null;
    const previousEarned = levelNumber === 1 ? true : earnedByLevel.has(levelNumber - 1);
    let status: CertificateLadderItem["status"] = "locked";
    if (earned) status = "earned";
    else if (stage === "beginner" && levelNumber === 1) status = "in_progress";
    else if (previousEarned && stage === "beginner") status = "locked";

    const lockedHint =
      status === "locked"
        ? levelNumber === 1
          ? `Unlocks with ${theme.title}`
          : `Unlocks after ${theme.title} Level ${levelNumber - 1}`
        : null;

    return {
      id: `${stage}-${levelNumber}`,
      title: `${theme.title} · Level ${levelNumber}`,
      cefr: theme.cefr,
      status,
      awardedOn: formatAwardedOn(earned?.issued_at),
      lockedHint,
      href:
        status === "earned"
          ? `/dashboard/learn/certificates/${stage}?level=${levelNumber}`
          : status === "in_progress"
            ? (kidsCourseHref ?? "/dashboard/learn")
            : null,
    };
  });
}

export async function loadCertificateLadder(
  supabase: SupabaseClient,
  userId: string,
  options: { kidsCourseHref: string | null }
): Promise<{
  isKid: boolean;
  items: CertificateLadderItem[];
  showSharedFormatFootnote: boolean;
}> {
  const actor = await resolveCourseActor(supabase, userId);
  if (actor.kind !== "kid") {
    return {
      isKid: false,
      items: MOCK_CERTIFICATES,
      showSharedFormatFootnote: true,
    };
  }

  const filter = actorFilter(actor);
  const { data, error } = await supabase
    .from("certificates")
    .select("id, level, kid_level_number, issued_at")
    .eq(filter.column, filter.value);

  if (error) {
    console.error("[certificates] kid load failed:", error.message);
  }

  const rows = (data ?? []) as CertificateRow[];
  const items = [
    ...kidSlotsForStage("beginner", rows, options.kidsCourseHref),
    ...kidSlotsForStage("intermediate", rows, options.kidsCourseHref).map((item) =>
      item.status === "earned"
        ? item
        : {
            ...item,
            status: "locked" as const,
            href: null,
            lockedHint: item.lockedHint ?? "Coming soon",
          }
    ),
    ...kidSlotsForStage("advanced", rows, options.kidsCourseHref).map((item) =>
      item.status === "earned"
        ? item
        : {
            ...item,
            status: "locked" as const,
            href: null,
            lockedHint: item.lockedHint ?? "Coming soon",
          }
    ),
  ];

  return {
    isKid: true,
    items,
    showSharedFormatFootnote: false,
  };
}
