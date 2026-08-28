import { NextResponse } from "next/server";
import { enactSessionSwitchApproval } from "@/lib/calendar/enact-session-switch";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorizedWebhook(request: Request): boolean {
  const secret = process.env.INTERNAL_SESSION_SWITCH_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-internal-session-switch-secret") === secret;
}

function parseRequestId(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const value = (json as { request_id?: unknown }).request_id;
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id.length > 0 ? id : null;
}

export async function POST(request: Request) {
  if (!isAuthorizedWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const requestId = parseRequestId(json);
  if (!requestId) {
    return NextResponse.json({ error: "request_id is required." }, { status: 400 });
  }

  try {
    const result = await enactSessionSwitchApproval(requestId);
    if (!result.ok) {
      console.error("[session-switch-approved] Enactment failed", {
        requestId,
        error: result.error,
      });
      return NextResponse.json(
        {
          ok: false,
          error: result.error,
          original_attendee_emails: result.originalAttendeeEmails ?? null,
          target_attendee_emails: result.targetAttendeeEmails ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      already_synced: Boolean(result.alreadySynced),
      session_switches_used: result.sessionSwitchesUsed ?? null,
      original_attendee_emails: result.originalAttendeeEmails ?? null,
      target_attendee_emails: result.targetAttendeeEmails ?? null,
    });
  } catch (error) {
    console.error("[session-switch-approved] Unhandled failure", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to enact session switch." }, { status: 500 });
  }
}
