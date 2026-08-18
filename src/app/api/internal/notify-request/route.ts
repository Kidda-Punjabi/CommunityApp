import { NextResponse } from "next/server";
import {
  parseNotifyRequestPayload,
  sendRequestNotifyEmail,
} from "@/lib/email/send-request-notify";

export const runtime = "nodejs";

function isAuthorizedWebhook(request: Request): boolean {
  const secret = process.env.INTERNAL_NOTIFY_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("x-internal-notify-secret") === secret;
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

  const parsed = parseNotifyRequestPayload(json);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await sendRequestNotifyEmail(parsed);
    if (result.error) {
      console.error("[notify-request] Resend send failed", {
        type: parsed.type,
        requestId: parsed.request_id,
        error: result.error,
      });
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("[notify-request] Unhandled send failure", {
      type: parsed.type,
      requestId: parsed.request_id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to send notification email." }, { status: 500 });
  }
}
