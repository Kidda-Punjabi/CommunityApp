import type {
  NotionLeadCacheOption,
  SalesCallListRow,
  SalesCallWriteInput,
} from "@/lib/admin/sales-calls/types";
import type { SupabaseClient } from "@supabase/supabase-js";

type SalesCallDbRow = {
  id: string;
  notes: string | null;
  call_date: string | null;
  lead_notion_page_id: string | null;
  user_id: string | null;
  outcome: string | null;
  sales_mechanism: string | null;
  call_length: number | null;
  ranking: string | null;
  course: string | null;
  delivery: string | null;
  tutor_select: string | null;
  tutor_person_id: string | null;
  show_up: boolean;
  offer: boolean;
  closed: boolean;
  payment_made: boolean;
  payment_date: string | null;
  cash_on_call: number | null;
  paid_afterwards: number | null;
  outstanding_balance: number | null;
  status: string | null;
  commission_amount: number | null;
  commission_paid: boolean;
  commission_valid: boolean;
  calendar_invite: boolean;
  welcome_email: boolean;
  whatsapp_chat_made: boolean;
  schedule_whatsapp_group: boolean;
  tutor_notified: boolean;
  time_assigned: boolean;
  package_created: boolean;
  offboarded: boolean;
  offboarded_1: boolean;
  notion_page_id: string | null;
  notion_sync_status: string;
  notion_sync_error: string | null;
  updated_at: string;
};

function mapRow(
  row: SalesCallDbRow,
  leadById: Map<string, NotionLeadCacheOption>
): SalesCallListRow {
  const lead = row.lead_notion_page_id ? leadById.get(row.lead_notion_page_id) : null;
  return {
    id: row.id,
    notes: row.notes,
    callDate: row.call_date,
    leadNotionPageId: row.lead_notion_page_id,
    leadName: lead?.name ?? null,
    leadEmail: lead?.email ?? null,
    userId: row.user_id,
    outcome: row.outcome,
    salesMechanism: row.sales_mechanism,
    callLength: row.call_length,
    ranking: row.ranking,
    course: row.course,
    delivery: row.delivery,
    tutorSelect: row.tutor_select,
    tutorPersonId: row.tutor_person_id,
    showUp: row.show_up,
    offer: row.offer,
    closed: row.closed,
    paymentMade: row.payment_made,
    paymentDate: row.payment_date,
    cashOnCall: row.cash_on_call,
    paidAfterwards: row.paid_afterwards,
    outstandingBalance: row.outstanding_balance,
    status: row.status,
    commissionAmount: row.commission_amount,
    commissionPaid: row.commission_paid,
    commissionValid: row.commission_valid,
    calendarInvite: row.calendar_invite,
    welcomeEmail: row.welcome_email,
    whatsappChatMade: row.whatsapp_chat_made,
    scheduleWhatsappGroup: row.schedule_whatsapp_group,
    tutorNotified: row.tutor_notified,
    timeAssigned: row.time_assigned,
    packageCreated: row.package_created,
    offboarded: row.offboarded,
    offboarded1: row.offboarded_1,
    notionPageId: row.notion_page_id,
    notionSyncStatus: row.notion_sync_status,
    notionSyncError: row.notion_sync_error,
    updatedAt: row.updated_at,
  };
}

function toDbPayload(input: SalesCallWriteInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.callDate !== undefined) payload.call_date = input.callDate;
  if (input.leadNotionPageId !== undefined) {
    payload.lead_notion_page_id = input.leadNotionPageId;
  }
  if (input.outcome !== undefined) payload.outcome = input.outcome;
  if (input.salesMechanism !== undefined) payload.sales_mechanism = input.salesMechanism;
  if (input.callLength !== undefined) payload.call_length = input.callLength;
  if (input.ranking !== undefined) payload.ranking = input.ranking;
  if (input.course !== undefined) payload.course = input.course;
  if (input.delivery !== undefined) payload.delivery = input.delivery;
  if (input.tutorSelect !== undefined) payload.tutor_select = input.tutorSelect;
  if (input.tutorPersonId !== undefined) payload.tutor_person_id = input.tutorPersonId;
  if (input.showUp !== undefined) payload.show_up = input.showUp;
  if (input.offer !== undefined) payload.offer = input.offer;
  if (input.closed !== undefined) payload.closed = input.closed;
  if (input.paymentMade !== undefined) payload.payment_made = input.paymentMade;
  if (input.paymentDate !== undefined) payload.payment_date = input.paymentDate;
  if (input.cashOnCall !== undefined) payload.cash_on_call = input.cashOnCall;
  if (input.paidAfterwards !== undefined) payload.paid_afterwards = input.paidAfterwards;
  if (input.outstandingBalance !== undefined) {
    payload.outstanding_balance = input.outstandingBalance;
  }
  if (input.status !== undefined) payload.status = input.status;
  if (input.commissionAmount !== undefined) {
    payload.commission_amount = input.commissionAmount;
  }
  if (input.commissionPaid !== undefined) payload.commission_paid = input.commissionPaid;
  if (input.commissionValid !== undefined) payload.commission_valid = input.commissionValid;
  if (input.calendarInvite !== undefined) payload.calendar_invite = input.calendarInvite;
  if (input.welcomeEmail !== undefined) payload.welcome_email = input.welcomeEmail;
  if (input.whatsappChatMade !== undefined) {
    payload.whatsapp_chat_made = input.whatsappChatMade;
  }
  if (input.scheduleWhatsappGroup !== undefined) {
    payload.schedule_whatsapp_group = input.scheduleWhatsappGroup;
  }
  if (input.tutorNotified !== undefined) payload.tutor_notified = input.tutorNotified;
  if (input.timeAssigned !== undefined) payload.time_assigned = input.timeAssigned;
  if (input.packageCreated !== undefined) payload.package_created = input.packageCreated;
  if (input.offboarded !== undefined) payload.offboarded = input.offboarded;
  if (input.offboarded1 !== undefined) payload.offboarded_1 = input.offboarded1;
  return payload;
}

async function resolveUserIdForLead(
  supabase: SupabaseClient,
  leadNotionPageId: string | null | undefined
): Promise<string | null> {
  if (!leadNotionPageId) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("notion_lead_page_id", leadNotionPageId)
    .maybeSingle();
  return data?.id ?? null;
}

async function fetchAllSalesCalls(supabase: SupabaseClient): Promise<{
  data: SalesCallDbRow[];
  error: { message: string } | null;
}> {
  // PostgREST caps a single response at 1000 rows by default — page through
  // so the admin list includes the full Sales Call Log (>=1250).
  const pageSize = 1000;
  const rows: SalesCallDbRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sales_calls")
      .select("*")
      .order("call_date", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) return { data: rows, error };
    const batch = (data ?? []) as SalesCallDbRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { data: rows, error: null };
}

async function fetchAllNotionLeadsCache(supabase: SupabaseClient): Promise<{
  data: Array<{
    notion_page_id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  }>;
  error: { message: string } | null;
}> {
  const pageSize = 1000;
  const rows: Array<{
    notion_page_id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
  }> = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("notion_leads_cache")
      .select("notion_page_id, name, email, phone")
      .range(from, from + pageSize - 1);

    if (error) return { data: rows, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { data: rows, error: null };
}

export async function loadSalesCallsList(supabase: SupabaseClient): Promise<{
  rows: SalesCallListRow[];
  error?: string;
}> {
  const [{ data, error }, { data: leads, error: leadsError }] = await Promise.all([
    fetchAllSalesCalls(supabase),
    fetchAllNotionLeadsCache(supabase),
  ]);

  if (error) {
    if (error.message.includes("sales_calls")) {
      return {
        rows: [],
        error: "Run supabase/notion-sales-call-sync.sql to enable sales calls.",
      };
    }
    return { rows: [], error: error.message };
  }

  if (leadsError) {
    return { rows: [], error: leadsError.message };
  }

  const leadById = new Map(
    (leads ?? []).map(
      (lead) =>
        [
          lead.notion_page_id,
          {
            notionPageId: lead.notion_page_id,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
          } satisfies NotionLeadCacheOption,
        ] as const
    )
  );

  return {
    rows: data.map((row) => mapRow(row, leadById)),
  };
}

export async function searchNotionLeadsCache(
  supabase: SupabaseClient,
  query: string
): Promise<{ results: NotionLeadCacheOption[]; error?: string }> {
  const q = query.trim();
  if (q.length < 2) return { results: [] };

  const sanitized = q.replace(/[%_,]/g, "");
  if (!sanitized) return { results: [] };

  const { data, error } = await supabase
    .from("notion_leads_cache")
    .select("notion_page_id, name, email, phone")
    .or(
      `name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,phone.ilike.%${sanitized}%`
    )
    .order("name", { ascending: true })
    .limit(25);

  if (error) return { results: [], error: error.message };

  return {
    results: (data ?? []).map((row) => ({
      notionPageId: row.notion_page_id,
      name: row.name,
      email: row.email,
      phone: row.phone,
    })),
  };
}

export async function createSalesCall(
  supabase: SupabaseClient,
  input: SalesCallWriteInput
): Promise<{ id?: string; error?: string }> {
  const payload = toDbPayload(input);
  payload.notion_sync_status = "pending";
  payload.user_id = await resolveUserIdForLead(
    supabase,
    input.leadNotionPageId ?? null
  );

  const { data, error } = await supabase
    .from("sales_calls")
    .insert(payload)
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id };
}

export async function updateSalesCall(
  supabase: SupabaseClient,
  id: string,
  input: SalesCallWriteInput
): Promise<{ error?: string }> {
  const payload = toDbPayload(input);
  if (input.leadNotionPageId !== undefined) {
    payload.user_id = await resolveUserIdForLead(supabase, input.leadNotionPageId);
  }
  payload.notion_sync_status = "pending";

  const { error } = await supabase.from("sales_calls").update(payload).eq("id", id);
  if (error) return { error: error.message };
  return {};
}
