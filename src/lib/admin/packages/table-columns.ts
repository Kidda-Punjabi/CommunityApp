import type { PackagesViewConfig } from "@/lib/admin/packages/types";

export const PACKAGE_TABLE_COLUMNS = [
  { id: "format", label: "Format" },
  { id: "interested", label: "Interested" },
  { id: "waitingForPayment", label: "Waiting for payment" },
  { id: "confirmed", label: "Confirmed" },
  { id: "startDay", label: "Start day" },
  { id: "tutor", label: "Tutor" },
  { id: "calendar", label: "Calendar event" },
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
      return "hidden min-w-[5.5rem] px-4 py-3 sm:table-cell";
    case "interested":
      return "min-w-[8.5rem] px-4 py-3";
    case "waitingForPayment":
      return "min-w-[8.5rem] px-4 py-3";
    case "confirmed":
      return "min-w-[8.5rem] px-4 py-3";
    case "startDay":
      return "hidden min-w-[6rem] px-4 py-3 md:table-cell";
    case "tutor":
      return "min-w-[9rem] px-4 py-3";
    case "calendar":
      return "min-w-[11rem] px-4 py-3";
    case "startDate":
      return "min-w-[6.5rem] whitespace-nowrap px-4 py-3";
    case "endDate":
      return "hidden min-w-[6.5rem] whitespace-nowrap px-4 py-3 sm:table-cell";
    case "status":
      return "min-w-[7rem] px-4 py-3";
    case "progress":
      return "hidden min-w-[10rem] px-4 py-3 text-center sm:table-cell";
    case "unlocks":
      return "hidden min-w-[4.5rem] px-4 py-3 text-center sm:table-cell";
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
    case "startDate":
      return "whitespace-nowrap px-4 py-3 text-zinc-600";
    case "endDate":
      return "hidden whitespace-nowrap px-4 py-3 text-zinc-600 sm:table-cell";
    case "unlocks":
      return "hidden px-4 py-3 text-center text-zinc-600 sm:table-cell";
    case "progress":
      return "hidden px-4 py-3 text-center align-middle text-zinc-600 sm:table-cell";
    case "tutor":
      return "px-4 py-3 align-top text-zinc-600";
    case "calendar":
      return "px-4 py-3 align-top text-zinc-600";
    case "status":
      return "px-4 py-3 align-middle";
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
