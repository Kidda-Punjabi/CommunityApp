import { loadAcquisitionSnapshot } from "@/lib/admin/acquisition/load-acquisition";
import type { AcquisitionRangeId } from "@/lib/admin/acquisition/types";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const RANGE_IDS = new Set<AcquisitionRangeId>(["7d", "30d", "quarter", "custom"]);

export async function GET(request: Request) {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user || !(await canAccessAdminPanel(user, authClient))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rangeParam = url.searchParams.get("rangeId") ?? "30d";
  const rangeId = RANGE_IDS.has(rangeParam as AcquisitionRangeId)
    ? (rangeParam as AcquisitionRangeId)
    : "30d";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  try {
    const snapshot = await loadAcquisitionSnapshot(createServiceRoleClient(), {
      rangeId,
      from,
      to,
    });
    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load acquisition.",
      },
      { status: 500 }
    );
  }
}
