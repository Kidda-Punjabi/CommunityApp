import "server-only";

import { GHL_LOCATION_ID, ghlJson } from "@/lib/ghl/client";

export const GHL_SALES_PIPELINE_NAMES = [
  "Beginners Course",
  "Foundational Course",
  "Kidda Community",
  "Kids Classes",
] as const;

export type GhlPipelineStage = {
  id: string;
  name: string;
  position: number;
};

export type GhlPipeline = {
  id: string;
  name: string;
  stages: GhlPipelineStage[];
};

export type GhlOpportunity = {
  id: string;
  name: string | null;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  monetaryValue: number | null;
  createdAt: string | null;
  lastStatusChangeAt: string | null;
  email: string | null;
};

type PipelinesResponse = {
  pipelines?: Array<{
    id?: string;
    name?: string;
    stages?: Array<{ id?: string; name?: string; position?: number }>;
  }>;
};

type SearchResponse = {
  opportunities?: Array<{
    id?: string;
    name?: string;
    pipelineId?: string;
    pipelineStageId?: string;
    status?: string;
    monetaryValue?: number | null;
    createdAt?: string;
    lastStatusChangeAt?: string;
    contact?: { email?: string | null };
  }>;
  meta?: {
    total?: number;
    nextPageUrl?: string | null;
    startAfterId?: string | null;
    startAfter?: number | null;
  };
};

export function isSalesPipelineName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  return GHL_SALES_PIPELINE_NAMES.some((salesName) => salesName.toLowerCase() === normalized);
}

export async function listGhlPipelines(
  locationId = GHL_LOCATION_ID,
  signal?: AbortSignal
): Promise<GhlPipeline[]> {
  const data = await ghlJson<PipelinesResponse>(
    `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    signal ? { signal } : undefined
  );
  return (data.pipelines ?? [])
    .map((pipeline) => ({
      id: pipeline.id ?? "",
      name: pipeline.name ?? "",
      stages: (pipeline.stages ?? [])
        .map((stage) => ({
          id: stage.id ?? "",
          name: stage.name ?? "",
          position: stage.position ?? 0,
        }))
        .filter((stage) => stage.id),
    }))
    .filter((pipeline) => pipeline.id);
}

export async function listGhlSalesPipelines(
  locationId = GHL_LOCATION_ID,
  signal?: AbortSignal
): Promise<GhlPipeline[]> {
  const pipelines = await listGhlPipelines(locationId, signal);
  return pipelines.filter((pipeline) => isSalesPipelineName(pipeline.name));
}

function mapOpportunity(row: NonNullable<SearchResponse["opportunities"]>[number]): GhlOpportunity {
  return {
    id: row.id ?? "",
    name: row.name ?? null,
    pipelineId: row.pipelineId ?? "",
    pipelineStageId: row.pipelineStageId ?? "",
    status: row.status ?? "",
    monetaryValue: typeof row.monetaryValue === "number" ? row.monetaryValue : null,
    createdAt: row.createdAt ?? null,
    lastStatusChangeAt: row.lastStatusChangeAt ?? null,
    email: row.contact?.email?.trim().toLowerCase() || null,
  };
}

export async function searchGhlOpportunities(options: {
  locationId?: string;
  pipelineId?: string;
  status?: "open" | "won" | "lost" | "abandoned" | "all";
  dateStartMs?: number;
  dateEndMs?: number;
  pageLimit?: number;
  signal?: AbortSignal;
}): Promise<{ opportunities: GhlOpportunity[]; total: number }> {
  const locationId = options.locationId ?? GHL_LOCATION_ID;
  const pageLimit = options.pageLimit ?? 100;
  const opportunities: GhlOpportunity[] = [];
  let startAfterId: string | undefined;
  let startAfter: number | undefined;
  let total = 0;
  const maxPages = 6;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      location_id: locationId,
      limit: String(pageLimit),
    });
    if (options.pipelineId) params.set("pipeline_id", options.pipelineId);
    if (options.status) params.set("status", options.status);
    if (options.dateStartMs != null) params.set("date", String(options.dateStartMs));
    if (options.dateEndMs != null) params.set("endDate", String(options.dateEndMs));
    if (startAfterId) params.set("startAfterId", startAfterId);
    if (startAfter != null) params.set("startAfter", String(startAfter));

    let data: SearchResponse;
    try {
      data = await ghlJson<SearchResponse>(`/opportunities/search?${params.toString()}`, {
        signal: options.signal,
      });
    } catch (error) {
      if (page === 0) throw error;
      break;
    }
    const batch = (data.opportunities ?? []).map(mapOpportunity).filter((row) => row.id);
    opportunities.push(...batch);
    total = data.meta?.total ?? opportunities.length;

    if (!data.meta?.nextPageUrl || batch.length === 0) break;
    startAfterId = data.meta.startAfterId ?? undefined;
    startAfter = data.meta.startAfter ?? undefined;
    if (!startAfterId) break;
  }

  return { opportunities, total };
}
