import type { PackagesViewConfig } from "@/lib/admin/packages/types";

export const PACKAGE_TABLE_COLUMNS = [
  { id: "format", label: "Format" },
  { id: "interested", label: "Interested" },
  { id: "waitingForPayment", label: "Waiting for payment" },
  { id: "confirmed", label: "Confirmed" },
  { id: "startDay", label: "Start day" },
  { id: "tutor", label: "Tutor & calendar" },
  { id: "startDate", label: "Start" },
  { id: "endDate", label: "End" },
  { id: "status", label: "Status" },
  { id: "progress", label: "Lesson progress" },
  { id: "unlocks", label: "Lessons unlocked" },
] as const;

export type PackageTableColumnId = (typeof PACKAGE_TABLE_COLUMNS)[number]["id"];

export const PACKAGE_TABLE_COLUMN_IDS = PACKAGE_TABLE_COLUMNS.map((column) => column.id);

export function packageColumnLabel(columnId: PackageTableColumnId): string {
  return PACKAGE_TABLE_COLUMNS.find((column) => column.id === columnId)?.label ?? columnId;
}

export function isPackageColumnVisible(
  config: PackagesViewConfig,
  columnId: PackageTableColumnId
): boolean {
  return !config.columns.hidden.includes(columnId);
}

export function packageColumnHeaderClass(columnId: PackageTableColumnId): string {
  switch (columnId) {
    case "format":
      return "hidden px-4 py-3 sm:table-cell lg:w-[8%]";
    case "interested":
      return "px-4 py-3 lg:w-[12%]";
    case "waitingForPayment":
      return "px-4 py-3 lg:w-[12%]";
    case "confirmed":
      return "px-4 py-3 lg:w-[12%]";
    case "startDay":
      return "hidden px-4 py-3 md:table-cell lg:w-[8%]";
    case "tutor":
      return "px-4 py-3 lg:w-[14%]";
    case "startDate":
      return "px-4 py-3 lg:w-[8%]";
    case "endDate":
      return "hidden px-4 py-3 sm:table-cell lg:w-[8%]";
    case "status":
      return "px-4 py-3 lg:w-[10%]";
    case "progress":
      return "hidden px-4 py-3 sm:table-cell lg:w-[12%]";
    case "unlocks":
      return "hidden px-4 py-3 sm:table-cell lg:w-[5%]";
    default:
      return "px-4 py-3";
  }
}

export function packageColumnCellClass(columnId: PackageTableColumnId): string {
  switch (columnId) {
    case "format":
      return "hidden px-4 py-3 sm:table-cell";
    case "startDay":
      return "hidden px-4 py-3 text-zinc-600 md:table-cell";
    case "endDate":
      return "hidden whitespace-nowrap px-4 py-3 text-zinc-600 sm:table-cell";
    case "unlocks":
      return "hidden px-4 py-3 text-zinc-600 sm:table-cell";
    case "progress":
      return "hidden px-4 py-3 text-zinc-600 sm:table-cell align-top";
    case "startDate":
      return "whitespace-nowrap px-4 py-3 text-zinc-600";
    case "tutor":
      return "px-4 py-3 text-zinc-600 align-top";
    default:
      return "px-4 py-3";
  }
}

export function parsePackageTableColumnIds(values: unknown): PackageTableColumnId[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is PackageTableColumnId =>
    PACKAGE_TABLE_COLUMN_IDS.includes(value as PackageTableColumnId)
  );
}
