import "server-only";

import { Resend } from "resend";
import { REQUEST_NOTIFY_FROM } from "@/lib/email/send-request-notify";

const CLEANUP_FAILURE_TO = "hello@kidda.app";

export async function sendCleanupFailureEmail(input: {
  filesFound: number;
  message: string;
}): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { error: "RESEND_API_KEY is not configured." };

  const lines = [
    "The Kidda file sweep failed twice in a row.",
    "",
    `Files found on the latest run: ${input.filesFound}`,
    `Error: ${input.message}`,
    "",
    "The admin overview shows the last sweep. No one needs to delete files by hand.",
  ];

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: REQUEST_NOTIFY_FROM,
    to: CLEANUP_FAILURE_TO,
    subject: "File sweep failed twice",
    text: lines.join("\n"),
  });

  if (error) return { error: error.message };
  return { id: data?.id };
}
