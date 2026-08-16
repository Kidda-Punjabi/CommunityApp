import { plainTextFromRichText, selectName } from "@/lib/notion/client";
import { startDayFromCalendarIso } from "@/lib/admin/package-schedule";

export type NotionPackageLinkInput = {
  packageName: string | null;
  rawProperties: Record<string, unknown>;
};

import type { SupabaseClient } from "@supabase/supabase-js";

export type CatalogCourse = {
  id: string;
  name: string;
  required_tier: string | null;
};

export type CatalogPackage = {
  id: string;
  name: string;
  course_id: string;
  delivery_mode: string | null;
  slug: string | null;
  active?: boolean;
};

export type ResolvedPackageLink = {
  packageId: string;
  courseId: string;
  packageName: string;
  courseName: string;
  notionCourse: string | null;
  notionDeliveryType: string | null;
  source: "notion_properties" | "title_inference";
};

export type ResolvedNotionSyncTarget = ResolvedPackageLink & {
  kind: "package_instance" | "cohort";
  cohortName: string | null;
};

export type PackageLinkSkipReason =
  | "group_delivery"
  | "community_not_supported"
  | "missing_course"
  | "missing_package"
  | "ambiguous";

function inferCourseFromTitle(title: string): string | null {
  if (/kids\s*circle/i.test(title) || (/kids/i.test(title) && /beginner/i.test(title))) {
    return "Kids Beginners Course";
  }
  if (/beginner/i.test(title)) return "Beginners Course";
  if (/foundational|refresher/i.test(title)) return "Foundational Course";
  if (/community/i.test(title)) return "Community";
  return null;
}

export function readNotionCourseLabel(page: NotionPackageLinkInput): string | null {
  const props = page.rawProperties as Record<
    string,
    { rich_text?: Array<{ plain_text?: string }> }
  >;
  const fromProperty = plainTextFromRichText(props.Course);
  const deliveryType = selectName(
    (page.rawProperties as Record<string, { select?: { name?: string } | null }>)["Delivery Type"]
  );
  const title = page.packageName ?? "";
  const fromTitle = inferCourseFromTitle(title);

  if (deliveryType?.toLowerCase() === "foundational course") return "Foundational Course";
  if (deliveryType?.toLowerCase() === "community") return "Kidda Community";
  if (fromTitle === "Kids Beginners Course") return fromTitle;

  if (fromProperty && fromTitle && fromProperty.trim().toLowerCase() !== fromTitle.toLowerCase()) {
    const propertyLower = fromProperty.toLowerCase();
    const titleLower = title.toLowerCase();
    if (
      (/foundational|refresher/.test(titleLower) || deliveryType?.toLowerCase() === "1-1") &&
      propertyLower.includes("beginner") &&
      (/foundational|refresher/.test(titleLower))
    ) {
      return "Foundational Course";
    }
    if (titleLower.includes("beginner") && /foundational|refresher/.test(propertyLower)) {
      return "Beginners Course";
    }
  }

  if (fromProperty) return fromProperty;
  return fromTitle;
}

export function readNotionDeliveryType(page: NotionPackageLinkInput): string | null {
  const props = page.rawProperties as Record<
    string,
    { select?: { name?: string } | null }
  >;
  return selectName(props["Delivery Type"]);
}

export function cohortDisplayNameFromNotionPage(page: NotionPackageLinkInput): string {
  const title = page.packageName?.trim() ?? "";
  const cohortMatch = title.match(/cohort\s*(\d+)/i);
  if (cohortMatch) return `Cohort ${cohortMatch[1]}`;

  const props = page.rawProperties as Record<
    string,
    { rich_text?: Array<{ plain_text?: string }> }
  >;
  const cohortNumber = plainTextFromRichText(props["Cohort Number"]);
  if (cohortNumber) {
    return cohortNumber.toLowerCase().includes("cohort")
      ? cohortNumber
      : `Cohort ${cohortNumber}`;
  }

  return title || "Imported cohort";
}

/** Derive weekday from the Notion Start Date calendar day (ignores the Start Day formula). */
export function readNotionStartDayOfWeek(page: {
  startDate?: string | null;
}): string | null {
  return startDayFromCalendarIso(page.startDate);
}

function courseByName(courses: CatalogCourse[], label: string | null): CatalogCourse | null {
  if (!label?.trim()) return null;
  const normalized = label.trim().toLowerCase();
  return (
    courses.find((course) => course.name.trim().toLowerCase() === normalized) ??
    courses.find((course) => {
      const name = course.name.toLowerCase();
      if (normalized.includes("kids") && (normalized.includes("beginner") || normalized.includes("circle"))) {
        return name.includes("kids") && name.includes("beginner");
      }
      if (normalized.includes("beginner")) {
        return name.includes("beginner") && !name.includes("kids");
      }
      if (normalized.includes("foundational") || normalized.includes("refresher")) {
        return name.includes("foundational");
      }
      if (normalized.includes("community")) return name.includes("community");
      return false;
    }) ??
    null
  );
}

function packageForNotionRow(
  packages: CatalogPackage[],
  course: CatalogCourse,
  deliveryType: string | null,
  notionCourseLabel: string | null
): CatalogPackage | null {
  const delivery = deliveryType?.trim().toLowerCase() ?? "";
  const coursePackages = packages.filter((pkg) => pkg.course_id === course.id);

  if (delivery === "group" || delivery === "group cohort") {
    return (
      coursePackages.find((pkg) => pkg.delivery_mode === "group") ??
      coursePackages.find((pkg) => pkg.name.toLowerCase().includes("group")) ??
      null
    );
  }

  if (delivery === "foundational course") {
    return (
      coursePackages.find((pkg) => pkg.slug === "foundational") ??
      coursePackages.find((pkg) => pkg.name.toLowerCase() === "foundational course") ??
      null
    );
  }

  if (delivery === "community" || course.name.toLowerCase().includes("community")) {
    return (
      packages.find((pkg) => pkg.slug === "community") ??
      packages.find((pkg) => pkg.name.toLowerCase().includes("community")) ??
      null
    );
  }

  if (course.required_tier === "beginners" || notionCourseLabel?.toLowerCase().includes("beginner")) {
    if (delivery === "1-1" || delivery === "one_to_one" || delivery === "one-to-one" || !delivery) {
      return (
        coursePackages.find((pkg) => pkg.delivery_mode === "one_to_one") ??
        coursePackages.find((pkg) => pkg.name.toLowerCase().includes("1-1")) ??
        null
      );
    }
  }

  if (
    course.required_tier === "foundational" ||
    notionCourseLabel?.toLowerCase().includes("foundational") ||
    notionCourseLabel?.toLowerCase().includes("refresher")
  ) {
    return (
      coursePackages.find((pkg) => pkg.name.toLowerCase() === "foundational course") ??
      coursePackages.find(
        (pkg) =>
          pkg.delivery_mode !== "group" &&
          pkg.delivery_mode !== "one_to_one" &&
          !pkg.name.toLowerCase().includes("community")
      ) ??
      null
    );
  }

  return coursePackages.find((pkg) => pkg.delivery_mode !== "group") ?? coursePackages[0] ?? null;
}

export function resolveNotionSyncTargetFromPage(
  page: NotionPackageLinkInput,
  packages: CatalogPackage[],
  courses: CatalogCourse[]
): { ok: true; link: ResolvedNotionSyncTarget } | { ok: false; reason: PackageLinkSkipReason; detail: string } {
  const notionCourse = readNotionCourseLabel(page);
  const notionDeliveryType = readNotionDeliveryType(page);
  const delivery = notionDeliveryType?.toLowerCase() ?? "";
  const kind: ResolvedNotionSyncTarget["kind"] = delivery === "group" ? "cohort" : "package_instance";

  const course = courseByName(courses, notionCourse);
  if (!course) {
    return {
      ok: false,
      reason: "missing_course",
      detail: notionCourse
        ? `Could not match course "${notionCourse}" to a catalog course.`
        : "No course found in Notion Course property or package title.",
    };
  }

  const pkg = packageForNotionRow(packages, course, notionDeliveryType, notionCourse);
  if (!pkg) {
    return {
      ok: false,
      reason: "missing_package",
      detail: `Could not match ${course.name} (${notionDeliveryType ?? "unknown delivery"}) to a catalog package.`,
    };
  }

  return {
    ok: true,
    link: {
      kind,
      packageId: pkg.id,
      courseId: course.id,
      packageName: pkg.name,
      courseName: course.name,
      notionCourse,
      notionDeliveryType,
      cohortName: kind === "cohort" ? cohortDisplayNameFromNotionPage(page) : null,
      source: plainTextFromRichText(
        (page.rawProperties as Record<string, { rich_text?: Array<{ plain_text?: string }> }>).Course
      )
        ? "notion_properties"
        : "title_inference",
    },
  };
}

export function resolvePackageLinkFromNotionPage(
  page: NotionPackageLinkInput,
  packages: CatalogPackage[],
  courses: CatalogCourse[]
): { ok: true; link: ResolvedPackageLink } | { ok: false; reason: PackageLinkSkipReason; detail: string } {
  const resolved = resolveNotionSyncTargetFromPage(page, packages, courses);
  if (!resolved.ok) return resolved;
  if (resolved.link.kind === "cohort") {
    return {
      ok: false,
      reason: "group_delivery",
      detail: "Group packages use cohorts in the app, not package instances.",
    };
  }
  return { ok: true, link: resolved.link };
}

export async function loadPackageCatalog(
  supabase: SupabaseClient
): Promise<{ packages: CatalogPackage[]; courses: CatalogCourse[] }> {
  const [{ data: packages }, { data: courses }] = await Promise.all([
    supabase
      .from("packages")
      .select("id, name, course_id, delivery_mode, slug, active")
      .order("display_order", { ascending: true }),
    supabase.from("courses").select("id, name, required_tier").order("display_order", { ascending: true }),
  ]);

  return {
    packages: (packages ?? []) as CatalogPackage[],
    courses: (courses ?? []) as CatalogCourse[],
  };
}
