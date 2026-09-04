import { timingSafeEqual } from "node:crypto";
import {
  findLatestLesson12FeedbackPageId,
  markVideoTestimonialTimeBooked,
  parseGhlCalendarObject,
} from "@/lib/ghl/mark-testimonial-booked";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bearerMatches(header: string | null, secret: string): boolean {
  if (!header) return false;
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  const token = match?.[1];
  if (!token) return false;

  const tokenBuf = Buffer.from(token);
  const secretBuf = Buffer.from(secret);
  if (tokenBuf.length !== secretBuf.length) return false;
  return timingSafeEqual(tokenBuf, secretBuf);
}

export async function POST(request: Request) {
  const secret = process.env.GHL_TESTIMONIAL_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("[ghl-testimonial-booked] GHL_TESTIMONIAL_WEBHOOK_SECRET is not set.");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 500 });
  }

  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error("[ghl-testimonial-booked] Rejected: invalid JSON.");
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    console.error("[ghl-testimonial-booked] Rejected: payload is not an object.");
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim() : "";
  if (!email || !EMAIL_RE.test(email)) {
    console.error("[ghl-testimonial-booked] Rejected: missing or invalid root email.", {
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const calendar = parseGhlCalendarObject(raw.calendar);
  if (!calendar) {
    console.error("[ghl-testimonial-booked] Rejected: missing calendar object.", {
      email,
      timestamp: new Date().toISOString(),
    });
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const pageId = await findLatestLesson12FeedbackPageId(email);
    if (!pageId) {
      console.error("[ghl-testimonial-booked] No matching Lesson 12 Notion page.", {
        email,
        timestamp: new Date().toISOString(),
        calendar,
      });
      return NextResponse.json(
        { error: "No matching Lesson 12 feedback page.", matched: false },
        { status: 404 }
      );
    }

    await markVideoTestimonialTimeBooked(pageId);
    console.info("[ghl-testimonial-booked] Marked Time Booked.", {
      email,
      pageId,
      timestamp: new Date().toISOString(),
      calendarName: calendar.calendarName,
      appointmentId: calendar.appointmentId,
      startTime: calendar.startTime,
    });
    return NextResponse.json({ ok: true, matched: true, pageId });
  } catch (error) {
    console.error("[ghl-testimonial-booked] Notion update failed.", {
      email,
      timestamp: new Date().toISOString(),
      calendar,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to update Notion." }, { status: 500 });
  }
}
