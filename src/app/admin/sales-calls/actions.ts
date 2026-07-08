"use server";

import { requireAdminFromActions, type ActionResult } from "@/app/admin/content/actions";
import {
  createSalesCall,
  loadSalesCallsList,
  searchNotionLeadsCache,
  updateSalesCall,
} from "@/lib/admin/sales-calls/load-sales-calls";
import type {
  NotionLeadCacheOption,
  SalesCallListRow,
  SalesCallWriteInput,
} from "@/lib/admin/sales-calls/types";
import { revalidatePath } from "next/cache";

const SALES_CALLS_PATH = "/admin/sales-calls";

export async function fetchSalesCallsList(): Promise<{
  rows: SalesCallListRow[];
  error?: string;
}> {
  try {
    const supabase = await requireAdminFromActions();
    return loadSalesCallsList(supabase);
  } catch (e) {
    return {
      rows: [],
      error: e instanceof Error ? e.message : "Failed to load sales calls.",
    };
  }
}

export async function searchSalesCallLeadsAction(
  query: string
): Promise<{ results?: NotionLeadCacheOption[]; error?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    return searchNotionLeadsCache(supabase, query);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Search failed." };
  }
}

export async function createSalesCallAction(
  input: SalesCallWriteInput
): Promise<ActionResult & { id?: string }> {
  try {
    const supabase = await requireAdminFromActions();
    const result = await createSalesCall(supabase, input);
    if (result.error) return { error: result.error };
    revalidatePath(SALES_CALLS_PATH);
    return { success: "Sales call created.", id: result.id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create sales call." };
  }
}

export async function updateSalesCallAction(
  id: string,
  input: SalesCallWriteInput
): Promise<ActionResult> {
  try {
    const supabase = await requireAdminFromActions();
    const result = await updateSalesCall(supabase, id, input);
    if (result.error) return { error: result.error };
    revalidatePath(SALES_CALLS_PATH);
    return { success: "Sales call updated." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to update sales call." };
  }
}
