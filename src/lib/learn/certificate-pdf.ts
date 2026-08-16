import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
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

const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const FOOTER_H = 30;
const PURPLE = rgb(124 / 255, 77 / 255, 224 / 255);
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.45, 0.45, 0.5);
const LINE = rgb(0.82, 0.8, 0.86);
const FOUNDER_NAME = "Gurupma Singh";
const SITE = "webapp.kidda.app";

const ASSET_ROOT = join(process.cwd(), "public");

let assetCache: {
  logo: Uint8Array;
  poppinsRegular: Uint8Array;
  poppinsSemi: Uint8Array;
  poppinsBold: Uint8Array;
  script: Uint8Array;
} | null = null;

async function loadAssets() {
  if (assetCache) return assetCache;
  const [logo, poppinsRegular, poppinsSemi, poppinsBold, script] = await Promise.all([
    readFile(join(ASSET_ROOT, "logo/kidda-peacock.png")),
    readFile(join(ASSET_ROOT, "fonts/certificate/Poppins-Regular.ttf")),
    readFile(join(ASSET_ROOT, "fonts/certificate/Poppins-SemiBold.ttf")),
    readFile(join(ASSET_ROOT, "fonts/certificate/Poppins-Bold.ttf")),
    readFile(join(ASSET_ROOT, "fonts/certificate/GreatVibes-Regular.ttf")),
  ]);
  assetCache = { logo, poppinsRegular, poppinsSemi, poppinsBold, script };
  return assetCache;
}

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

function drawTrackedCentered(
  page: PDFPage,
  text: string,
  y: number,
  font: PDFFont,
  size: number,
  color: ReturnType<typeof rgb>,
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
  const blockW = 200;
  const scriptSize = 26;
  let size = scriptSize;
  while (size > 16 && options.scriptFont.widthOfTextAtSize(options.scriptName, size) > blockW) {
    size -= 1;
  }
  const scriptW = options.scriptFont.widthOfTextAtSize(options.scriptName, size);
  page.drawText(options.scriptName, {
    x: options.centerX - scriptW / 2,
    y: options.scriptY,
    font: options.scriptFont,
    size,
    color: INK,
  });

  const lineY = options.scriptY - 10;
  page.drawLine({
    start: { x: options.centerX - 78, y: lineY },
    end: { x: options.centerX + 78, y: lineY },
    thickness: 0.7,
    color: LINE,
  });

  const nameSize = 9;
  const nameW = options.nameFont.widthOfTextAtSize(options.printedName, nameSize);
  page.drawText(options.printedName, {
    x: options.centerX - nameW / 2,
    y: lineY - 16,
    font: options.nameFont,
    size: nameSize,
    color: INK,
  });

  const titleSize = 8;
  const titleW = options.titleFont.widthOfTextAtSize(options.title, titleSize);
  page.drawText(options.title, {
    x: options.centerX - titleW / 2,
    y: lineY - 28,
    font: options.titleFont,
    size: titleSize,
    color: MUTED,
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

  const assets = await loadAssets();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const poppins = await pdf.embedFont(assets.poppinsRegular);
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

  const logoSize = 58;
  page.drawImage(logo, {
    x: (PAGE_WIDTH - logoSize) / 2,
    y: PAGE_HEIGHT - 80,
    width: logoSize,
    height: logoSize,
  });

  drawTrackedCentered(page, "KIDDA", PAGE_HEIGHT - 102, poppinsBold, 16, PURPLE, 5.5);
  drawTrackedCentered(
    page,
    "CERTIFICATE OF ACHIEVEMENT",
    PAGE_HEIGHT - 128,
    poppinsSemi,
    10,
    PURPLE,
    2.4
  );

  drawCentered(page, "This certifies that", PAGE_HEIGHT - 162, poppins, 12, MUTED);

  let nameSize = 34;
  while (nameSize > 18 && poppinsBold.widthOfTextAtSize(studentName, nameSize) > PAGE_WIDTH - 160) {
    nameSize -= 1;
  }
  drawCentered(page, studentName, PAGE_HEIGHT - 204, poppinsBold, nameSize, INK);

  const body = `has successfully completed the ${courseTitle} Course, demonstrating confident, everyday spoken Punjabi through live tutor-led classes.`;
  const bodyLines = wrapText(body, poppins, 12, 560);
  let bodyY = PAGE_HEIGHT - 236;
  for (const line of bodyLines) {
    drawCentered(page, line, bodyY, poppins, 12, MUTED);
    bodyY -= 18;
  }

  const badge = `CEFR ${cefr}`;
  const badgeSize = 10;
  const badgePadX = 16;
  const badgeH = 22;
  const badgeW = poppinsSemi.widthOfTextAtSize(badge, badgeSize) + badgePadX * 2;
  const badgeX = (PAGE_WIDTH - badgeW) / 2;
  const badgeY = bodyY - 28;
  const badgeR = badgeH / 2;
  page.drawCircle({ x: badgeX + badgeR, y: badgeY + badgeR, size: badgeR, color: PURPLE });
  page.drawCircle({
    x: badgeX + badgeW - badgeR,
    y: badgeY + badgeR,
    size: badgeR,
    color: PURPLE,
  });
  page.drawRectangle({
    x: badgeX + badgeR,
    y: badgeY,
    width: badgeW - badgeH,
    height: badgeH,
    color: PURPLE,
  });
  page.drawText(badge, {
    x: badgeX + badgePadX,
    y: badgeY + 6.5,
    font: poppinsSemi,
    size: badgeSize,
    color: rgb(1, 1, 1),
  });

  const scriptY = 168;
  drawSignatureBlock(page, {
    centerX: PAGE_WIDTH / 2 - 130,
    scriptY,
    scriptFont: script,
    nameFont: poppinsSemi,
    titleFont: poppins,
    scriptName: founderName,
    printedName: founderName,
    title: "Founder",
  });
  drawSignatureBlock(page, {
    centerX: PAGE_WIDTH / 2 + 130,
    scriptY,
    scriptFont: script,
    nameFont: poppinsSemi,
    titleFont: poppins,
    scriptName: tutorName,
    printedName: tutorName,
    title: "Course Tutor",
  });

  const metaY = 96;
  const dateText = awardedOn ? `Awarded ${awardedOn}` : "";
  if (dateText) {
    const dateW = poppins.widthOfTextAtSize(dateText, 9);
    const siteW = poppins.widthOfTextAtSize(SITE, 9);
    const metaGap = 28;
    const metaTotal = dateW + metaGap + siteW;
    const metaX = (PAGE_WIDTH - metaTotal) / 2;
    page.drawText(dateText, { x: metaX, y: metaY, font: poppins, size: 9, color: MUTED });
    page.drawText(SITE, {
      x: metaX + dateW + metaGap,
      y: metaY,
      font: poppins,
      size: 9,
      color: MUTED,
    });
  } else {
    drawCentered(page, SITE, metaY, poppins, 9, MUTED);
  }

  const disclaimer = certificateCefrDisclaimer(cefr);
  const disclaimerLines = wrapText(disclaimer, poppins, 7.5, PAGE_WIDTH - 120);
  let disclaimerY = FOOTER_H + 14 + (disclaimerLines.length - 1) * 10;
  for (const line of disclaimerLines) {
    drawCentered(page, line, disclaimerY, poppins, 7.5, MUTED);
    disclaimerY -= 10;
  }

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: FOOTER_H,
    color: PURPLE,
  });

  return pdf.save();
}
