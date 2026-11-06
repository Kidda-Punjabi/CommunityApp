import "server-only";

import { GHL_LOCATION_ID, ghlJson } from "@/lib/ghl/client";
import type { ComingSoonCourseLevel } from "@/lib/learn/course-interest";

/**
 * Where an app "Register interest" lands in GoHighLevel. Live pipeline and
 * stage ids, read from the Kidda location on 2026-11-06.
 */
const PIPELINE_FOR_LEVEL: Record<
  ComingSoonCourseLevel,
  { pipelineId: string; stageId: string; pipelineName: string }
> = {
  intermediate: {
    pipelineId: "9bxGZSUGyQJ776vX985r",
    stageId: "4f311af4-f90f-4cf0-83bb-3deece2be08b",
    pipelineName: "Intermediate Course (Adults)",
  },
  advanced: {
    pipelineId: "0S0pVRCX7E1px3qP8dn5",
    stageId: "42faeeb7-f441-459d-b0b2-948a1431f9a3",
    pipelineName: "Advanced Course (Adults)",
  },
  kids_intermediate: {
    pipelineId: "z5zm95yi58Ov9qqvgi7j",
    stageId: "b8fb0db6-52dc-4296-a8f9-d5c4ef614a97",
    pipelineName: "Kids Classes",
  },
  kids_advanced: {
    pipelineId: "z5zm95yi58Ov9qqvgi7j",
    stageId: "b8fb0db6-52dc-4296-a8f9-d5c4ef614a97",
    pipelineName: "Kids Classes",
  },
};

export function courseInterestPipelineName(level: ComingSoonCourseLevel): string {
  return PIPELINE_FOR_LEVEL[level].pipelineName;
}

type UpsertResponse = { contact?: { id?: string }; new?: boolean };
type SearchResponse = { opportunities?: Array<{ id?: string }> };
type CreateResponse = { opportunity?: { id?: string } };

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

/**
 * Find or create the contact by email, then create one open opportunity in the
 * course's pipeline unless they already have an open one there.
 * Never overwrites an existing contact's name or tags.
 */
export async function createCourseInterestOpportunity(input: {
  level: ComingSoonCourseLevel;
  email: string;
  fullName: string;
  courseTitle: string;
  timelineLabel: string;
}): Promise<{ opportunityId: string | null; contactId: string; created: boolean }> {
  const target = PIPELINE_FOR_LEVEL[input.level];

  const upsert = await ghlJson<UpsertResponse>("/contacts/upsert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locationId: GHL_LOCATION_ID,
      email: input.email,
      source: "Kidda app: register interest",
    }),
  });
  const contactId = upsert.contact?.id;
  if (!contactId) throw new Error("GHL upsert returned no contact id");

  if (upsert.new && input.fullName.trim()) {
    const { firstName, lastName } = splitName(input.fullName);
    await ghlJson(`/contacts/${encodeURIComponent(contactId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, name: input.fullName.trim() }),
    }).catch((error) => {
      console.error("[course-interest] GHL contact name update failed", error);
    });
  }

  const params = new URLSearchParams({
    location_id: GHL_LOCATION_ID,
    contact_id: contactId,
    pipeline_id: target.pipelineId,
    status: "open",
    limit: "1",
  });
  const existing = await ghlJson<SearchResponse>(`/opportunities/search?${params.toString()}`);
  const existingId = existing.opportunities?.[0]?.id;
  if (existingId) {
    return { opportunityId: existingId, contactId, created: false };
  }

  const name = `${input.fullName.trim() || input.email} | ${input.courseTitle} interest (${input.timelineLabel})`;
  const created = await ghlJson<CreateResponse>("/opportunities/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locationId: GHL_LOCATION_ID,
      pipelineId: target.pipelineId,
      pipelineStageId: target.stageId,
      contactId,
      name: name.slice(0, 250),
      status: "open",
      source: "Kidda app: register interest",
    }),
  });

  return { opportunityId: created.opportunity?.id ?? null, contactId, created: true };
}
