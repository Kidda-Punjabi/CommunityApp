import "server-only";

import { Resend } from "resend";
import { REQUEST_NOTIFY_FROM } from "@/lib/email/send-request-notify";

const DELETION_NOTICE_TO = "hello@kidda.app";

export type DeletionNoticePerson = {
  label: string;
  files: string[];
};

export async function sendDeletionNoticeEmail(input: {
  daysAhead: 14 | 3;
  deleteOnLabel: string;
  people: DeletionNoticePerson[];
}): Promise<{ id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return { error: "RESEND_API_KEY is not configured." };
  if (input.people.length === 0) return {};

  const blocks = input.people.map((person) =>
    [`Person: ${person.label}`, ...person.files.map((file) => `- ${file}`)].join("\n")
  );
  const lines = [
    `Kidda will delete the files below on ${input.deleteOnLabel}.`,
    `This is the ${input.daysAhead}-day notice.`,
    "",
    ...blocks.flatMap((block) => [block, ""]),
    input.daysAhead === 14
      ? "A second email will go out 3 days before that date."
      : "These files will be deleted on that date.",
  ];

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: REQUEST_NOTIFY_FROM,
    to: DELETION_NOTICE_TO,
    subject: `Details will be deleted in ${input.daysAhead} days`,
    text: lines.join("\n"),
  });

  if (error) return { error: error.message };
  return { id: data?.id };
}

export function formatDeletionDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00Z`);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
