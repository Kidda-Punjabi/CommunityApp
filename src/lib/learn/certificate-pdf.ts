import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CERTIFICATE_CEFR_DISCLAIMER } from "@/lib/learn/certificate-mock";

export type CertificatePdfInput = {
  studentName: string;
  courseTitle: string;
  cefr: string;
  awardedOn: string;
};

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const VIOLET = rgb(0.486, 0.227, 0.929);
const VIOLET_SOFT = rgb(0.91, 0.87, 0.98);
const INK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.44, 0.45, 0.48);

function pdfSafeText(value: string): string {
  return Array.from(value.normalize("NFKC"))
    .map((ch) => (ch.charCodeAt(0) <= 255 ? ch : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: (PAGE_WIDTH - width) / 2,
    y,
    font,
    size,
    color,
  });
}

export function certificatePdfFileName(studentName: string, courseTitle: string): string {
  const who = pdfSafeText(studentName).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "Student";
  const course = pdfSafeText(courseTitle).replace(/[^\w]+/g, "-").replace(/^-|-$/g, "") || "Course";
  return `Kidda-${course}-Certificate-${who}.pdf`;
}

export async function buildCertificatePdf(input: CertificatePdfInput): Promise<Uint8Array> {
  const studentName = pdfSafeText(input.studentName) || "Student";
  const courseTitle = pdfSafeText(input.courseTitle) || "Beginner";
  const cefr = pdfSafeText(input.cefr) || "A2";
  const awardedOn = pdfSafeText(input.awardedOn) || "";

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const heading = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const body = await pdf.embedFont(StandardFonts.TimesRoman);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(1, 1, 1),
  });
  page.drawRectangle({
    x: 28,
    y: 28,
    width: PAGE_WIDTH - 56,
    height: PAGE_HEIGHT - 56,
    borderColor: VIOLET,
    borderWidth: 3,
  });
  page.drawRectangle({
    x: 38,
    y: 38,
    width: PAGE_WIDTH - 76,
    height: PAGE_HEIGHT - 76,
    borderColor: VIOLET_SOFT,
    borderWidth: 1.5,
  });

  drawCentered(page, "KIDDA", PAGE_HEIGHT - 92, sansBold, 14, VIOLET);
  drawCentered(page, "CERTIFICATE OF COMPLETION", PAGE_HEIGHT - 148, sansBold, 12, VIOLET);

  let nameSize = 36;
  while (nameSize > 18 && heading.widthOfTextAtSize(studentName, nameSize) > PAGE_WIDTH - 140) {
    nameSize -= 2;
  }
  drawCentered(page, studentName, PAGE_HEIGHT - 220, heading, nameSize, INK);

  const awardLine = `has been awarded the Kidda ${courseTitle} certificate`;
  drawCentered(page, awardLine, PAGE_HEIGHT - 268, body, 16, MUTED);

  const badge = `CEFR ${cefr}`;
  const badgeWidth = sansBold.widthOfTextAtSize(badge, 11) + 28;
  const badgeHeight = 26;
  const badgeX = (PAGE_WIDTH - badgeWidth) / 2;
  const badgeY = PAGE_HEIGHT - 322;
  page.drawRectangle({
    x: badgeX,
    y: badgeY,
    width: badgeWidth,
    height: badgeHeight,
    color: VIOLET_SOFT,
    borderColor: VIOLET,
    borderWidth: 0.8,
  });
  page.drawText(badge, {
    x: badgeX + 14,
    y: badgeY + 8,
    font: sansBold,
    size: 11,
    color: VIOLET,
  });

  if (awardedOn) {
    drawCentered(page, `Awarded ${awardedOn}`, PAGE_HEIGHT - 368, sans, 12, MUTED);
  }

  const disclaimerLines = wrapText(
    CERTIFICATE_CEFR_DISCLAIMER,
    sans,
    8,
    PAGE_WIDTH - 160
  );
  let disclaimerY = 72;
  for (const line of disclaimerLines.reverse()) {
    drawCentered(page, line, disclaimerY, sans, 8, MUTED);
    disclaimerY += 11;
  }

  return pdf.save();
}
