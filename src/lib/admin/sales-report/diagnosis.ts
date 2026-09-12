import { UNASSIGNED_SALESPERSON } from "@/lib/admin/sales-report/mapping";
import type { SalespersonRow, SalesReport } from "@/lib/admin/sales-report/types";

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function pts(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  const rounded = Math.round(value * 100);
  if (rounded === 0) return "0pts";
  return `${rounded > 0 ? "+" : ""}${rounded}pts`;
}

function pounds(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

export function diagnoseSalesReport(
  report: SalesReport,
  previousPeople: SalespersonRow[]
): string[] {
  const lines: string[] = [];
  const close = report.headline.closeRate;
  const show = report.headline.showRate;
  const collected = report.headline.revenueCollected;

  lines.push(
    `Team close rate was ${pct(close.current)} (${report.headline.callsClosed.current} closed from ${report.headline.callsTaken.current} calls taken), ${
      close.vsPreviousPts == null
        ? "with no prior-period close rate to compare."
        : `that is ${pts(close.vsPreviousPts)} vs ${report.range.previousLabel}.`
    }`
  );

  if (collected.vsPreviousPct != null) {
    const direction = collected.vsPreviousDirection === "down" ? "down" : "up";
    lines.push(
      `Revenue collected was ${pounds(collected.current)}, ${direction} ${Math.round(
        Math.abs(collected.vsPreviousPct) * 100
      )}% vs the previous period (${pounds(collected.previous ?? 0)}).`
    );
  } else {
    lines.push(`Revenue collected was ${pounds(collected.current)} in this range.`);
  }

  const previousByName = new Map(previousPeople.map((row) => [row.name, row]));
  let biggestMover: { name: string; pts: number } | null = null;
  for (const row of report.salespeople) {
    if (row.name === UNASSIGNED_SALESPERSON) continue;
    const prev = previousByName.get(row.name);
    if (prev?.closeRate == null || row.closeRate == null) continue;
    const delta = row.closeRate - prev.closeRate;
    if (!biggestMover || Math.abs(delta) > Math.abs(biggestMover.pts)) {
      biggestMover = { name: row.name, pts: delta };
    }
  }

  if (biggestMover && Math.abs(biggestMover.pts) >= 0.05) {
    const prev = previousByName.get(biggestMover.name);
    const current = report.salespeople.find((row) => row.name === biggestMover?.name);
    const showFlat =
      current?.showRate != null &&
      prev?.showRate != null &&
      Math.abs(current.showRate - prev.showRate) < 0.03;
    if (biggestMover.pts < 0 && showFlat) {
      lines.push(
        `${biggestMover.name}'s close rate dropped ${pts(biggestMover.pts)} while show rate stayed flat (${pct(current?.showRate ?? null)}). Worth a call review.`
      );
    } else {
      lines.push(
        `Biggest close-rate mover was ${biggestMover.name} at ${pts(biggestMover.pts)} vs the previous period.`
      );
    }
  }

  const flagged = report.salespeople.filter((row) => row.discountingFlag);
  for (const row of flagged) {
    lines.push(
      `${row.name} has a high close rate (${pct(row.closeRate)}) with a lower AOV (${pounds(row.aovClosed ?? 0)} vs team ${pounds(report.teamTotals.aovClosed ?? 0)}). That usually means over-discounting, not stronger closing skill.`
    );
  }

  const topDrop = [...report.funnel]
    .filter((stage) => stage.dropOffFromPrevious != null)
    .sort((a, b) => (b.dropOffFromPrevious ?? 0) - (a.dropOffFromPrevious ?? 0))[0];
  if (topDrop?.dropOffFromPrevious != null && topDrop.dropOffFromPrevious >= 0.5) {
    lines.push(
      `Largest funnel drop-off is into ${topDrop.name.toLowerCase()} (${pct(topDrop.dropOffFromPrevious)} from the previous stage).`
    );
  }

  if (report.followUps.reduce((sum, row) => sum + row.count, 0) > 0) {
    const leader = report.followUps[0];
    lines.push(
      `Open follow-ups now: ${report.followUps.reduce((sum, row) => sum + row.count, 0)} (most with ${leader.salesperson}, ${leader.count}). ${report.aging.length} have had no Notion edit in ${report.agingDays} days.`
    );
  }

  if (report.dataQuality.hasGaps) {
    lines.push(`Data quality: ${report.dataQuality.summary}`);
  }

  if (show.vsPreviousPts != null && Math.abs(show.vsPreviousPts) >= 0.05) {
    lines.push(`Show rate is ${pts(show.vsPreviousPts)} vs the previous period, now ${pct(show.current)}.`);
  }

  return lines;
}
