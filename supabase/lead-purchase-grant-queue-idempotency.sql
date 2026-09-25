-- =============================================================================
-- Kidda — Idempotent open rows on notion_lead_purchase_grant_queue
-- One unresolved row per profile + reason + sorted package page ids.
-- Project: pztubczhqkzcwtkstpgi
-- =============================================================================

CREATE OR REPLACE FUNCTION public.lead_grant_queue_package_ids_hash(raw jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
DECLARE
  hashed text;
BEGIN
  SELECT md5(coalesce(string_agg(elem, ',' ORDER BY elem), ''))
  INTO hashed
  FROM jsonb_array_elements_text(
    CASE
      WHEN raw IS NULL THEN '[]'::jsonb
      WHEN jsonb_typeof(raw -> 'packagePageIds') = 'array' THEN raw -> 'packagePageIds'
      ELSE '[]'::jsonb
    END
  ) AS elem;

  RETURN coalesce(hashed, md5(''));
END;
$$;

COMMENT ON FUNCTION public.lead_grant_queue_package_ids_hash(jsonb) IS
  'md5 of sorted packagePageIds from a lead grant queue payload. Empty when the array is missing.';

-- Keep the oldest open duplicate. Do not touch rows that are already resolved.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY profile_id, reason, public.lead_grant_queue_package_ids_hash(raw_package_data)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.notion_lead_purchase_grant_queue
  WHERE resolved IS NOT TRUE
)
UPDATE public.notion_lead_purchase_grant_queue AS q
SET
  resolved = true,
  resolved_at = now(),
  resolution_note = 'Collapsed duplicate open queue row before the idempotency index.'
FROM ranked
WHERE q.id = ranked.id
  AND ranked.rn > 1
  AND q.resolved IS NOT TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS notion_lead_purchase_grant_queue_open_package_key
  ON public.notion_lead_purchase_grant_queue (
    profile_id,
    reason,
    public.lead_grant_queue_package_ids_hash(raw_package_data)
  )
  WHERE resolved IS NOT TRUE;

COMMENT ON INDEX public.notion_lead_purchase_grant_queue_open_package_key IS
  'One unresolved queue row per profile, reason, and sorted package page id set.';

NOTIFY pgrst, 'reload schema';
