export const PACKAGE_INSTANCE_STATUSES = [
  "pre_scheduling",
  "recruiting",
  "scheduled",
  "in_progress",
  "paused",
  "postponed",
  "incomplete",
  "classes_completed",
  "offboarding_complete",
] as const;

export type PackageInstanceStatus = (typeof PACKAGE_INSTANCE_STATUSES)[number];

export type PackageStatusBucket = "todo" | "in_progress" | "complete";

export const PACKAGE_MEMBERSHIP_STATUSES = [
  "interested",
  "waiting_for_payment",
  "confirmed",
  "withdrawn",
] as const;

export type PackageMembershipStatus = (typeof PACKAGE_MEMBERSHIP_STATUSES)[number];

export function packageStatusBucket(status: PackageInstanceStatus): PackageStatusBucket {
  if (status === "pre_scheduling" || status === "recruiting" || status === "scheduled") {
    return "todo";
  }
  if (status === "in_progress" || status === "paused") {
    return "in_progress";
  }
  return "complete";
}

export function packageStatusLabel(status: PackageInstanceStatus): string {
  const labels: Record<PackageInstanceStatus, string> = {
    pre_scheduling: "Pre-scheduling",
    recruiting: "Recruiting",
    scheduled: "Scheduled",
    in_progress: "In progress",
    paused: "Paused",
    postponed: "Postponed",
    incomplete: "Incomplete",
    classes_completed: "Classes completed",
    offboarding_complete: "Offboarding complete",
  };
  return labels[status] ?? status;
}

export function packageStatusPillTone(
  status: PackageInstanceStatus
): "amber" | "violet" | "green" | "zinc" {
  const bucket = packageStatusBucket(status);
  if (bucket === "todo") return "amber";
  if (bucket === "in_progress") return "violet";
  return "green";
}

export function membershipStatusLabel(status: PackageMembershipStatus): string {
  const labels: Record<PackageMembershipStatus, string> = {
    interested: "Interested",
    waiting_for_payment: "Waiting for payment",
    confirmed: "Confirmed",
    withdrawn: "Withdrawn",
  };
  return labels[status] ?? status;
}

export type PackageDeliveryFormat = "group" | "one_to_one" | "community";

export const PACKAGE_DELIVERY_FORMATS: PackageDeliveryFormat[] = [
  "group",
  "one_to_one",
  "community",
];

export function packageDeliveryFormat(row: {
  kind: "cohort" | "package_instance" | "community";
  deliveryMode: "group" | "one_to_one" | null;
}): PackageDeliveryFormat {
  if (row.kind === "community") return "community";
  if (row.deliveryMode === "group") return "group";
  return "one_to_one";
}

export function packageDeliveryFormatLabel(format: PackageDeliveryFormat): string {
  const labels: Record<PackageDeliveryFormat, string> = {
    group: "Group",
    one_to_one: "1-1",
    community: "Community",
  };
  return labels[format];
}

export function packageDeliveryFormatPillTone(
  format: PackageDeliveryFormat
): "amber" | "violet" | "green" | "zinc" {
  if (format === "group") return "violet";
  if (format === "one_to_one") return "amber";
  return "green";
}

const PACKAGE_DELIVERY_FORMAT_SORT_ORDER: Record<PackageDeliveryFormat, number> = {
  group: 0,
  one_to_one: 1,
  community: 2,
};

export function comparePackageDeliveryFormats(
  a: PackageDeliveryFormat,
  b: PackageDeliveryFormat
): number {
  return PACKAGE_DELIVERY_FORMAT_SORT_ORDER[a] - PACKAGE_DELIVERY_FORMAT_SORT_ORDER[b];
}
