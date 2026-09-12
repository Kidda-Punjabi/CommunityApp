import { formatCount, formatPercent, formatPounds, formatWhen } from "@/lib/admin/sales-report/format";
import { getAcquisitionSalesReport } from "@/lib/admin/sales-report/generate";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function line(text: string) {
  return text.replace(/\u2014/g, "-");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user || !(await canAccessAdminPanel(user, authClient))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const report = await getAcquisitionSalesReport(createServiceRoleClient(), id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595, 842];
  let page = pdf.addPage(pageSize);
  let y = 812;
  const ink = rgb(0.14, 0.1, 0.2);
  const muted = rgb(0.44, 0.4, 0.49);

  const addPage = () => {
    page = pdf.addPage(pageSize);
    y = 812;
  };

  const write = (text: string, size = 10, useBold = false) => {
    if (y < 40) addPage();
    page.drawText(line(text).slice(0, 110), {
      x: 36,
      y,
      size,
      font: useBold ? bold : font,
      color: useBold ? ink : muted,
    });
    y -= size + 6;
  };

  write("Kidda sales report", 16, true);
  write(`${report.range.label}  |  generated ${formatWhen(report.generatedAt)}`, 10, true);
  y -= 6;
  write(`Revenue collected  ${formatPounds(report.headline.revenueCollected.current)}`, 12, true);
  write(`Revenue booked  ${formatPounds(report.headline.revenueBooked.current)}`, 12, true);
  write(
    `Close rate  ${formatPercent(report.headline.closeRate.current)}  (${formatCount(report.headline.callsClosed.current)} / ${formatCount(report.headline.callsTaken.current)} taken)`,
    12,
    true
  );
  write(
    `Show rate  ${formatPercent(report.headline.showRate.current)}   Booking rate  ${formatPercent(report.headline.bookingRate.current)}`,
    11,
    true
  );
  y -= 8;
  write("Salespeople", 13, true);
  write(
    "Name  | taken  | closed  | close%  | show%  | AOV  | collected  | rank",
    9,
    true
  );
  for (const row of [...report.salespeople, report.teamTotals]) {
    write(
      `${row.name}  | ${row.callsTaken}  | ${row.callsClosed}  | ${formatPercent(row.closeRate)}  | ${formatPercent(row.showRate)}  | ${formatPounds(row.aovClosed)}  | ${formatPounds(row.revenueCollected)}  | ${row.name === "Team" ? "-" : `#${row.revenueRank}`}`,
      9
    );
  }
  y -= 8;
  write("Diagnosis", 13, true);
  for (const item of report.diagnosis) write(item, 10);
  y -= 8;
  write("Data quality", 13, true);
  write(report.dataQuality.summary, 10, true);
  for (const gap of report.dataQuality.gaps) {
    write(`${gap.field}: ${gap.rowCount} rows. ${gap.note}`, 9);
  }
  y -= 8;
  write(report.productCatalogueNote, 9);
  write(report.lostReasonNote, 9);

  const bytes = await pdf.save();
  const filename = `kidda-sales-report-${report.range.startYmd}-to-${report.range.endYmd}.pdf`;
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
