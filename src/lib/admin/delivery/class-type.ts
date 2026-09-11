import type { DeliveryClassTypeId } from "@/lib/admin/delivery/constants";

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function classTypeFromFeedback(
  course: string | null | undefined,
  cohort: string | null | undefined
): DeliveryClassTypeId | null {
  const courseNorm = norm(course);
  const cohortNorm = norm(cohort);

  if (courseNorm === "community" || cohortNorm === "community") return "community";
  if (courseNorm.includes("foundational") || cohortNorm.includes("foundational")) {
    return "foundational";
  }
  if (cohortNorm.includes("refresh")) return "refresher";
  if (
    cohortNorm === "1-1" ||
    cohortNorm.includes("1-1") ||
    cohortNorm.includes("one-to-one") ||
    cohortNorm.includes("one to one")
  ) {
    return "one_to_one";
  }
  if (courseNorm.includes("beginner")) return "beginner_group";
  return null;
}

export function classTypeFromEnrollment(
  courseName: string | null | undefined,
  deliveryMode: string | null | undefined
): DeliveryClassTypeId | null {
  const courseNorm = norm(courseName);
  if (courseNorm.includes("kid") || courseNorm.includes("english") || courseNorm.includes("uk ")) {
    return null;
  }
  if (courseNorm.includes("community")) return "community";
  if (courseNorm.includes("foundational")) return "foundational";
  if (courseNorm.includes("refresh")) return "refresher";
  if (norm(deliveryMode) === "one_to_one") return "one_to_one";
  if (courseNorm.includes("beginner") && norm(deliveryMode) === "group") return "beginner_group";
  if (courseNorm.includes("beginner")) return "beginner_group";
  return null;
}

export function classTypeLabel(id: DeliveryClassTypeId | null): string {
  if (id === "beginner_group") return "Beginner Group";
  if (id === "one_to_one") return "1-1";
  if (id === "foundational") return "Foundational";
  if (id === "refresher") return "Refresher";
  if (id === "community") return "Community";
  return "—";
}
