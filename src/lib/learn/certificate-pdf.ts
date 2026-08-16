import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { certificateCefrDisclaimer } from "@/lib/learn/certificate-mock";

export type CertificatePdfInput = {
  studentName: string;
  courseTitle: string;
  cefr: string;
  awardedOn: string;
  tutorName: string;
  founderName?: string;
};

/** A4 landscape. HTML mock is 1123×794px at 96dpi; 1 CSS px = 0.75pt. */
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const PX = 0.75;
const FOOTER_H = 46 * PX;

const PURPLE = rgb(124 / 255, 77 / 255, 224 / 255);
const INK = rgb(38 / 255, 33 / 255, 92 / 255);
const BODY = rgb(74 / 255, 69 / 255, 104 / 255);
const PRESENTED = rgb(107 / 255, 102 / 255, 136 / 255);
const EYEBROW = rgb(166 / 255, 162 / 255, 190 / 255);
const CEFR_BG = rgb(238 / 255, 237 / 255, 254 / 255);
const CEFR_INK = rgb(60 / 255, 52 / 255, 137 / 255);
const SIG_LINE = rgb(214 / 255, 211 / 255, 230 / 255);
const SIG_TITLE = rgb(139 / 255, 135 / 255, 163 / 255);
const DISCLAIMER = rgb(184 / 255, 180 / 255, 204 / 255);
const FOOTER_INK = rgb(239 / 255, 234 / 255, 252 / 255);

const FOUNDER_NAME = "Gurupma Singh";
const SITE = "webapp.kidda.app";
const FOOTER_COPY = "KIDDA  ·  SPEAKING PUNJABI WITH CONFIDENCE";

const ASSET_ROOT = join(process.cwd(), "public");

let assetCache: {
  logo: Uint8Array;
  poppinsRegular: Uint8Array;
  poppinsMedium: Uint8Array;
  poppinsSemi: Uint8Array;
  poppinsBold: Uint8Array;
  script: Uint8Array;
} | null = null;

async function loadAssets() {
  if (assetCache) return assetCache;
  const [logo, poppinsRegular, poppinsMedium, poppinsSemi, poppinsBold, script] = await Promise.all([
    readFile(join(ASSET_ROOT, "logo/kidda-peacock.png")),
    readFile(join(ASSET_ROOT, "fonts/certificate/Poppins-Regular.ttf")),
    readFile(join(ASSET_ROOT, "fonts/certificate/Poppins-Medium.ttf")),
    readFile(join(ASSET_ROOT, "fonts/certificate/Poppins-SemiBold.ttf")),
    readFile(join(ASSET_ROOT, "fonts/certificate/Poppins-Bold.ttf")),
    readFile(join(ASSET_ROOT, "fonts/certificate/Caveat-SemiBold.ttf")),
  ]);
  assetCache = { logo, poppinsRegular, poppinsMedium, poppinsSemi, poppinsBold, script };
  return assetCache;
}

function pdfSafeText(value: string): string {
  return Array.from(value.normalize("NFKC"))
    .map((ch) => (ch.charCodeAt(0) <= 255 ? ch : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed || /^course tutor$/i.test(trimmed)) return "Tutor";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function courseLabel(courseTitle: string): string {
  return /course$/i.test(courseTitle) ? courseTitle : `${courseTitle} Course`;
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
  color: RGB
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

function drawTrackedCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB,
  tracking: number
) {
  const chars = [...text];
  const total =
    chars.reduce((sum, ch) => sum + font.widthOfTextAtSize(ch, size), 0) +
    tracking * Math.max(0, chars.length - 1);
  let x = (PAGE_WIDTH - total) / 2;
  for (const ch of chars) {
    page.drawText(ch, { x, y, font, size, color });
    x += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

type TextRun = { text: string; font: PDFFont; size: number; color: RGB };

function drawCenteredRuns(page: PDFPage, runs: TextRun[], y: number) {
  const total = runs.reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, run.size), 0);
  let x = (PAGE_WIDTH - total) / 2;
  for (const run of runs) {
    page.drawText(run.text, {
      x,
      y,
      font: run.font,
      size: run.size,
      color: run.color,
    });
    x += run.font.widthOfTextAtSize(run.text, run.size);
  }
}

function drawPill(
  page: PDFPage,
  options: { text: string; font: PDFFont; size: number; y: number }
) {
  const padX = 18 * PX;
  const height = 25 * PX;
  const width = options.font.widthOfTextAtSize(options.text, options.size) + padX * 2;
  const x = (PAGE_WIDTH - width) / 2;
  const radius = height / 2;
  page.drawCircle({ x: x + radius, y: options.y + radius, size: radius, color: CEFR_BG });
  page.drawCircle({
    x: x + width - radius,
    y: options.y + radius,
    size: radius,
    color: CEFR_BG,
  });
  page.drawRectangle({
    x: x + radius,
    y: options.y,
    width: width - height,
    height,
    color: CEFR_BG,
  });
  page.drawText(options.text, {
    x: x + padX,
    y: options.y + 6.2 * PX,
    font: options.font,
    size: options.size,
    color: CEFR_INK,
  });
}

function drawScriptName(
  page: PDFPage,
  text: string,
  centerX: number,
  y: number,
  font: PDFFont,
  size: number,
  color: RGB
) {
  const chars = [...text];
  const widths = chars.map((ch) => font.widthOfTextAtSize(ch, size));
  const total = widths.reduce((sum, width) => sum + width, 0);
  let x = centerX - total / 2;
  for (let i = 0; i < chars.length; i++) {
    page.drawText(chars[i], { x, y, font, size, color });
    x += widths[i];
  }
  return total;
}

function drawSignatureBlock(
  page: PDFPage,
  options: {
    centerX: number;
    scriptY: number;
    scriptFont: PDFFont;
    nameFont: PDFFont;
    titleFont: PDFFont;
    scriptName: string;
    printedName: string;
    title: string;
  }
) {
  const blockW = 210 * PX;
  const scriptSize = 40 * PX;
  let size = scriptSize;
  while (size > 18 && options.scriptFont.widthOfTextAtSize(options.scriptName, size) > blockW) {
    size -= 1;
  }
  drawScriptName(page, options.scriptName, options.centerX, options.scriptY, options.scriptFont, size, INK);

  const lineY = options.scriptY - 6 * PX;
  page.drawLine({
    start: { x: options.centerX - blockW / 2, y: lineY },
    end: { x: options.centerX + blockW / 2, y: lineY },
    thickness: 1.4 * PX,
    color: SIG_LINE,
  });

  const nameSize = 13.5 * PX;
  const nameW = options.nameFont.widthOfTextAtSize(options.printedName, nameSize);
  page.drawText(options.printedName, {
    x: options.centerX - nameW / 2,
    y: lineY - 8 * PX - nameSize * 0.2,
    font: options.nameFont,
    size: nameSize,
    color: INK,
  });

  const titleSize = 11.5 * PX;
  const titleW = options.titleFont.widthOfTextAtSize(options.title, titleSize);
  page.drawText(options.title, {
    x: options.centerX - titleW / 2,
    y: lineY - 8 * PX - nameSize - 1 * PX - titleSize * 0.15,
    font: options.titleFont,
    size: titleSize,
    color: SIG_TITLE,
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
  const tutorName = pdfSafeText(input.tutorName) || "Course Tutor";
  const founderName = pdfSafeText(input.founderName || FOUNDER_NAME) || FOUNDER_NAME;
  const courseName = courseLabel(courseTitle);

  const assets = await loadAssets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const poppins = await pdf.embedFont(assets.poppinsRegular);
  const poppinsMedium = await pdf.embedFont(assets.poppinsMedium);
  const poppinsSemi = await pdf.embedFont(assets.poppinsSemi);
  const poppinsBold = await pdf.embedFont(assets.poppinsBold);
  const script = await pdf.embedFont(assets.script);
  const logo = await pdf.embedPng(assets.logo);

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: rgb(1, 1, 1),
  });

  const motifR = 110 * PX;
  page.drawCircle({
    x: 20 * PX,
    y: PAGE_HEIGHT - 20 * PX,
    size: motifR,
    color: PURPLE,
    opacity: 0.05,
  });
  page.drawCircle({
    x: PAGE_WIDTH - 20 * PX,
    y: 20 * PX,
    size: motifR,
    color: PURPLE,
    opacity: 0.05,
  });

  const logoW = 74 * PX;
  const logoH = logoW * (logo.height / logo.width);

  let nameSize = 44 * PX;
  while (nameSize > 22 && poppinsSemi.widthOfTextAtSize(studentName, nameSize) > PAGE_WIDTH - 180) {
    nameSize -= 1;
  }

  const bodySize = 16 * PX;
  const bodyLead = 16 * 1.7 * PX;
  const disclaimerSize = 10.5 * PX;
  const disclaimerLead = 10.5 * 1.5 * PX;
  const disclaimer = certificateCefrDisclaimer(cefr);
  const disclaimerLines = wrapText(disclaimer, poppins, disclaimerSize, 520 * PX);

  const stackH =
    logoH +
    10 * PX +
    26 * PX +
    34 * PX +
    13 * PX +
    22 * PX +
    15 * PX +
    10 * PX +
    nameSize * 1.1 +
    22 * PX +
    bodyLead +
    6 * PX +
    bodyLead +
    18 * PX +
    25 * PX +
    46 * PX +
    50 * PX +
    6 * PX +
    8 * PX +
    13.5 * PX +
    1 * PX +
    11.5 * PX +
    34 * PX +
    12 * PX +
    10 * PX +
    disclaimerLines.length * disclaimerLead;

  const contentH = PAGE_HEIGHT - FOOTER_H;
  let y = FOOTER_H + (contentH + stackH) / 2;

  const advance = (amount: number) => {
    y -= amount;
    return y;
  };

  page.drawImage(logo, {
    x: (PAGE_WIDTH - logoW) / 2,
    y: advance(logoH),
    width: logoW,
    height: logoH,
  });
  advance(10 * PX);

  drawTrackedCentered(page, "KIDDA", advance(26 * PX), poppinsBold, 26 * PX, PURPLE, 1 * PX);
  advance(34 * PX);

  drawTrackedCentered(
    page,
    "CERTIFICATE OF ACHIEVEMENT",
    advance(13 * PX),
    poppinsMedium,
    13 * PX,
    EYEBROW,
    3 * PX
  );
  advance(22 * PX);

  drawCentered(page, "This certifies that", advance(15 * PX), poppins, 15 * PX, PRESENTED);
  advance(10 * PX);

  drawCentered(page, studentName, advance(nameSize * 1.1), poppinsSemi, nameSize, INK);
  advance(22 * PX);

  drawCenteredRuns(page, [
    { text: "has successfully completed the ", font: poppins, size: bodySize, color: BODY },
    { text: courseName, font: poppinsBold, size: bodySize, color: INK },
    { text: ",", font: poppins, size: bodySize, color: BODY },
  ], advance(bodyLead));
  advance(6 * PX);
  drawCentered(
    page,
    "demonstrating confident, everyday spoken Punjabi through live tutor-led classes.",
    advance(bodyLead),
    poppins,
    bodySize,
    BODY
  );

  advance(18 * PX);
  const badgeY = advance(25 * PX);
  drawPill(page, {
    text: `CEFR ${cefr}  ·  Speaking Proficiency`,
    font: poppinsSemi,
    size: 13 * PX,
    y: badgeY,
  });

  advance(46 * PX);
  const scriptY = advance(50 * PX) + 8 * PX;
  const sigCenterOffset = (210 / 2 + 130 / 2) * PX;
  drawSignatureBlock(page, {
    centerX: PAGE_WIDTH / 2 - sigCenterOffset,
    scriptY,
    scriptFont: script,
    nameFont: poppinsSemi,
    titleFont: poppins,
    scriptName: firstName(founderName),
    printedName: founderName,
    title: "Founder, Kidda",
  });
  drawSignatureBlock(page, {
    centerX: PAGE_WIDTH / 2 + sigCenterOffset,
    scriptY,
    scriptFont: script,
    nameFont: poppinsSemi,
    titleFont: poppins,
    scriptName: firstName(tutorName),
    printedName: tutorName === "Course Tutor" ? "Course Tutor" : tutorName,
    title: "Course Tutor",
  });
  advance(6 * PX + 8 * PX + 13.5 * PX + 1 * PX + 11.5 * PX);

  advance(34 * PX);
  const dateLine = awardedOn ? `Awarded ${awardedOn}  ·  ${SITE}` : SITE;
  drawCentered(page, dateLine, advance(12 * PX), poppins, 12 * PX, EYEBROW);

  advance(10 * PX);
  for (const line of disclaimerLines) {
    drawCentered(page, line, advance(disclaimerLead), poppins, disclaimerSize, DISCLAIMER);
  }

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: FOOTER_H,
    color: PURPLE,
  });
  drawTrackedCentered(
    page,
    FOOTER_COPY,
    (FOOTER_H - 12 * PX) / 2 + 1.5,
    poppinsMedium,
    12 * PX,
    FOOTER_INK,
    0.5 * PX
  );

  return pdf.save();
}
