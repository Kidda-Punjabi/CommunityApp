import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeSalesReport } from "./compute";
import { addLondonDays, londonMondayOf, resolveSalesReportRange, ymdInInclusiveRange } from "./date-range";
import { isPaidInFull, productLabel } from "./mapping";
import type { LeadRecord, SalesCallRecord, SalesReportRange } from "./types";

function rangeFor(startYmd: string, endYmd: string): SalesReportRange {
  return {
    preset: "custom",
    startYmd,
    endYmd,
    previousStartYmd: addLondonDays(startYmd, -7),
    previousEndYmd: addLondonDays(startYmd, -1),
    mtdStartYmd: startYmd.slice(0, 8) + "01",
    mtdEndYmd: endYmd,
    label: `${startYmd} to ${endYmd}`,
    previousLabel: "previous",
    mtdLabel: "mtd",
  };
}

function call(partial: Partial<SalesCallRecord> & { pageId: string }): SalesCallRecord {
  return {
    lastEditedTime: "2026-09-10T12:00:00.000Z",
    callDate: null,
    paymentDate: null,
    salespersonId: null,
    salespersonName: null,
    salespersonCount: 0,
    outcome: null,
    showUp: false,
    closed: false,
    cashOnCall: null,
    paidAfterwards: null,
    outstandingBalance: null,
    outBalStatus: null,
    course: null,
    delivery: null,
    leadPageId: null,
    notes: null,
    ...partial,
  };
}

function lead(partial: Partial<LeadRecord> & { pageId: string }): LeadRecord {
  return {
    createdTime: "2026-09-08T10:00:00.000Z",
    createdYmd: "2026-09-08",
    leadSource: null,
    name: null,
    ...partial,
  };
}

describe("sales report week bounds", () => {
  it("treats the reporting week as Monday to Sunday", () => {
    const saturday = resolveSalesReportRange("this_week", new Date("2026-09-12T12:00:00.000Z"));
    assert.equal(saturday.startYmd, "2026-09-07");
    assert.equal(saturday.endYmd, "2026-09-13");
    assert.equal(londonMondayOf("2026-09-13"), "2026-09-07");
  });

  it("uses last week's full Monday to Sunday for the last_week preset", () => {
    const range = resolveSalesReportRange("last_week", new Date("2026-09-12T12:00:00.000Z"));
    assert.equal(range.startYmd, "2026-08-31");
    assert.equal(range.endYmd, "2026-09-06");
    assert.equal(range.previousStartYmd, "2026-08-24");
    assert.equal(range.previousEndYmd, "2026-08-30");
  });
});

describe("paid in full", () => {
  it("requires both outstanding balance and out-bal status to be empty", () => {
    assert.equal(isPaidInFull(null, null), true);
    assert.equal(isPaidInFull(0, null), true);
    assert.equal(isPaidInFull(null, "Paid"), false);
    assert.equal(isPaidInFull(150, null), false);
  });
});

describe("computeSalesReport", () => {
  const range = rangeFor("2026-09-01", "2026-09-07");

  it("attributes collected revenue by Payment Date, not Call Date", () => {
    const report = computeSalesReport({
      range,
      generatedAt: "2026-09-10T12:00:00.000Z",
      agingDays: 7,
      productCatalogueAvailable: false,
      leads: [],
      calls: [
        call({
          pageId: "old-call-new-payment",
          salespersonName: "Adnan Arsalani",
          callDate: "2026-08-20",
          paymentDate: "2026-09-03",
          closed: true,
          showUp: true,
          cashOnCall: 400,
        }),
        call({
          pageId: "called-this-week-paid-later",
          salespersonName: "Adnan Arsalani",
          callDate: "2026-09-02",
          paymentDate: "2026-09-20",
          closed: true,
          showUp: true,
          paidAfterwards: 340,
        }),
      ],
    });

    assert.equal(report.headline.revenueCollected.current, 400);
    assert.equal(report.headline.revenueBooked.current, 340);
    assert.equal(report.salespeople[0].revenueCollected, 400);
  });

  it("does not treat a second cash amount on the same row as a new deal", () => {
    const report = computeSalesReport({
      range,
      generatedAt: "2026-09-10T12:00:00.000Z",
      agingDays: 7,
      productCatalogueAvailable: false,
      leads: [],
      calls: [
        call({
          pageId: "one-deal",
          salespersonName: "Harsimran Kaur",
          callDate: "2026-09-02",
          paymentDate: "2026-09-02",
          closed: true,
          showUp: true,
          cashOnCall: 200,
          paidAfterwards: 150,
        }),
      ],
    });

    assert.equal(report.headline.callsClosed.current, 1);
    assert.equal(report.headline.revenueCollected.current, 350);
    assert.equal(report.salespeople[0].cashOnCallCount, 1);
    assert.equal(report.salespeople[0].paidAfterwardsCount, 1);
  });

  it("computes close rate from calls taken (showed) vs closed", () => {
    const report = computeSalesReport({
      range,
      generatedAt: "2026-09-10T12:00:00.000Z",
      agingDays: 7,
      productCatalogueAvailable: false,
      leads: [lead({ pageId: "l1" }), lead({ pageId: "l2" })],
      calls: [
        call({
          pageId: "show-close",
          salespersonName: "Adnan Arsalani",
          callDate: "2026-09-02",
          showUp: true,
          closed: true,
          course: "Beginners Course",
          delivery: "Group",
        }),
        call({
          pageId: "show-open",
          salespersonName: "Adnan Arsalani",
          callDate: "2026-09-03",
          showUp: true,
          closed: false,
        }),
        call({
          pageId: "no-show",
          salespersonName: "Adnan Arsalani",
          callDate: "2026-09-04",
          showUp: false,
          outcome: "No Show",
        }),
      ],
    });

    assert.equal(report.headline.callsTaken.current, 2);
    assert.equal(report.headline.callsClosed.current, 1);
    assert.equal(report.headline.closeRate.current, 0.5);
    assert.equal(report.headline.showRate.current, 2 / 3);
    assert.equal(report.salespeople[0].closeRate, 0.5);
  });

  it("groups salespeople from Person names dynamically and flags missing Person/Outcome", () => {
    const report = computeSalesReport({
      range,
      generatedAt: "2026-09-10T12:00:00.000Z",
      agingDays: 7,
      productCatalogueAvailable: false,
      leads: [],
      calls: [
        call({
          pageId: "named",
          salespersonName: "Harsimran Kaur",
          callDate: "2026-09-02",
          showUp: true,
          closed: true,
          paymentDate: "2026-09-02",
          cashOnCall: 400,
          course: "Beginners Course",
          delivery: "Group",
        }),
        call({
          pageId: "gap",
          salespersonName: null,
          callDate: "2026-09-03",
          showUp: true,
          outcome: null,
        }),
      ],
    });

    assert.deepEqual(
      report.salespeople.map((row) => row.name).sort(),
      ["Harsimran Kaur", "Unassigned"]
    );
    assert.equal(report.dataQuality.hasGaps, true);
    const fields = report.dataQuality.gaps.map((gap) => gap.field);
    assert.ok(fields.includes("Person (salesperson)"));
    assert.ok(fields.includes("Outcome"));
  });

  it("flags recorded financing balances instead of silently dropping the deal", () => {
    const report = computeSalesReport({
      range,
      generatedAt: "2026-09-10T12:00:00.000Z",
      agingDays: 7,
      productCatalogueAvailable: false,
      leads: [],
      calls: [
        call({
          pageId: "finance",
          salespersonName: "Adnan Arsalani",
          callDate: "2026-09-02",
          paymentDate: "2026-09-02",
          showUp: true,
          closed: true,
          cashOnCall: 200,
          outstandingBalance: 200,
          outBalStatus: "Scheduled",
          course: "Beginners Course",
          delivery: "Group",
        }),
      ],
    });

    assert.equal(report.headline.callsClosed.current, 1);
    assert.equal(report.headline.revenueCollected.current, 200);
    assert.equal(report.financingFlags.length, 1);
    assert.equal(report.financingFlags[0].outstandingBalance, 200);
  });

  it("maps Course and Delivery onto the locked offer names", () => {
    assert.equal(productLabel("Beginners Course", "Group"), "Beginner Group");
    assert.equal(productLabel("Beginners Course", "1-1"), "1-1");
    assert.equal(productLabel("Foundational Course", "Group"), "Foundational/Refresher");
    assert.equal(productLabel("Community", "Group"), "Community membership");
  });

  it("keeps lost reasons on Outcome and notes that competitor/timing are not logged", () => {
    const report = computeSalesReport({
      range,
      generatedAt: "2026-09-10T12:00:00.000Z",
      agingDays: 7,
      productCatalogueAvailable: false,
      leads: [],
      calls: [
        call({
          pageId: "lost",
          salespersonName: "Adnan Arsalani",
          callDate: "2026-09-02",
          outcome: "Can't Afford",
          showUp: true,
        }),
      ],
    });
    assert.equal(report.lostReasons[0]?.reason, "Can't Afford");
    assert.match(report.lostReasonNote, /no separate lost-reason field/i);
  });

  it("ages open follow-ups from last edited time, not the selected range", () => {
    const report = computeSalesReport({
      range,
      generatedAt: "2026-09-12T12:00:00.000Z",
      agingDays: 7,
      productCatalogueAvailable: false,
      leads: [],
      calls: [
        call({
          pageId: "stale",
          salespersonName: "Gurupma Singh",
          callDate: "2026-08-01",
          outcome: "Follow Up",
          lastEditedTime: "2026-08-20T12:00:00.000Z",
        }),
      ],
    });
    assert.equal(report.followUps[0]?.count, 1);
    assert.equal(report.aging[0]?.pageId, "stale");
    assert.ok((report.aging[0]?.daysSinceTouch ?? 0) >= 7);
  });

  it("flags a high close rate with a notably lower AOV as over-discounting", () => {
    const report = computeSalesReport({
      range,
      generatedAt: "2026-09-10T12:00:00.000Z",
      agingDays: 7,
      productCatalogueAvailable: false,
      leads: [],
      calls: [
        call({
          pageId: "a1",
          salespersonName: "Rep A",
          callDate: "2026-09-01",
          showUp: true,
          closed: true,
          paymentDate: "2026-09-01",
          cashOnCall: 400,
          course: "Beginners Course",
          delivery: "Group",
        }),
        call({
          pageId: "a2",
          salespersonName: "Rep A",
          callDate: "2026-09-02",
          showUp: true,
          closed: false,
        }),
        call({
          pageId: "b1",
          salespersonName: "Rep B",
          callDate: "2026-09-01",
          showUp: true,
          closed: true,
          paymentDate: "2026-09-01",
          cashOnCall: 100,
          course: "Beginners Course",
          delivery: "Group",
        }),
        call({
          pageId: "b2",
          salespersonName: "Rep B",
          callDate: "2026-09-02",
          showUp: true,
          closed: true,
          paymentDate: "2026-09-02",
          cashOnCall: 100,
          course: "Beginners Course",
          delivery: "Group",
        }),
      ],
    });
    const repB = report.salespeople.find((row) => row.name === "Rep B");
    assert.equal(repB?.discountingFlag, true);
    assert.ok(report.diagnosis.some((line) => line.includes("Rep B") && line.includes("over-discounting")));
  });
});

describe("ymd range helper", () => {
  it("includes both endpoints", () => {
    assert.equal(ymdInInclusiveRange("2026-09-01", "2026-09-01", "2026-09-07"), true);
    assert.equal(ymdInInclusiveRange("2026-09-07", "2026-09-01", "2026-09-07"), true);
    assert.equal(ymdInInclusiveRange("2026-08-31", "2026-09-01", "2026-09-07"), false);
  });
});
