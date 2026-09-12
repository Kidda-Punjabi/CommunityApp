-- Timestamped sales report snapshots for the Acquisition dashboard.
-- Viewing a past report reads this table; it does not re-query Notion.

CREATE TABLE IF NOT EXISTS public.acquisition_sales_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  range_preset text NOT NULL,
  range_start date NOT NULL,
  range_end date NOT NULL,
  range_label text NOT NULL,
  aging_days integer NOT NULL DEFAULT 7,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  source_fetched_at timestamptz NOT NULL,
  notion_call_pages integer NOT NULL DEFAULT 0,
  notion_lead_pages integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL,
  CONSTRAINT acquisition_sales_reports_preset_check
    CHECK (range_preset IN ('this_week', 'last_week', 'this_month', 'last_month', 'custom')),
  CONSTRAINT acquisition_sales_reports_aging_check
    CHECK (aging_days >= 1 AND aging_days <= 30)
);

CREATE INDEX IF NOT EXISTS idx_acquisition_sales_reports_generated_at
  ON public.acquisition_sales_reports (generated_at DESC);

COMMENT ON TABLE public.acquisition_sales_reports IS
  'Timestamped sales report snapshots generated from the Notion Sales Call Log and Leads database. Past reports are immutable artifacts.';

ALTER TABLE public.acquisition_sales_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read sales reports" ON public.acquisition_sales_reports;
CREATE POLICY "Staff read sales reports"
  ON public.acquisition_sales_reports FOR SELECT TO authenticated
  USING (public.is_community_lead());

DROP POLICY IF EXISTS "Staff insert sales reports" ON public.acquisition_sales_reports;
CREATE POLICY "Staff insert sales reports"
  ON public.acquisition_sales_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_community_lead());

GRANT SELECT, INSERT ON public.acquisition_sales_reports TO authenticated;
GRANT ALL ON public.acquisition_sales_reports TO service_role;

NOTIFY pgrst, 'reload schema';
