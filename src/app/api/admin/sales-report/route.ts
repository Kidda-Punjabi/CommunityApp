import {
  generateAcquisitionSalesReport,
  getAcquisitionSalesReport,
  listAcquisitionSalesReports,
  parseSalesReportPreset,
} from "@/lib/admin/sales-report/generate";
import { canAccessAdminPanel } from "@/lib/auth/admin-access";
import { createServiceRoleClient } from "@/lib/supabase/admin-server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

async function requireAdminUser() {
  const authClient = await createClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user || !(await canAccessAdminPanel(user, authClient))) {
    return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const supabase = createServiceRoleClient();

  try {
    if (id) {
      const report = await getAcquisitionSalesReport(supabase, id);
      if (!report) {
        return NextResponse.json({ error: "Report not found." }, { status: 404 });
      }
      return NextResponse.json({ id, report });
    }
    const reports = await listAcquisitionSalesReports(supabase);
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sales reports." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if (auth.response) return auth.response;

  let body: {
    preset?: string;
    from?: string;
    to?: string;
    agingDays?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const preset = parseSalesReportPreset(body.preset);
  if (preset === "custom" && !(body.from && body.to && body.from <= body.to)) {
    return NextResponse.json(
      { error: "Custom range needs a start date on or before the end date." },
      { status: 400 }
    );
  }

  try {
    const result = await generateAcquisitionSalesReport(createServiceRoleClient(), {
      preset,
      from: body.from,
      to: body.to,
      agingDays: body.agingDays,
      generatedBy: auth.user?.id ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate sales report." },
      { status: 500 }
    );
  }
}
