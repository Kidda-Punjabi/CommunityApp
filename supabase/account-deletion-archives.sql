-- Kidda — keep financial facts after an account is deleted, without a user id.
-- Run in Supabase SQL Editor (project pztubczhqkzcwtkstpgi).

CREATE TABLE IF NOT EXISTS public.account_deletion_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  stripe_customer_ids text[] NOT NULL DEFAULT '{}',
  stripe_subscription_ids text[] NOT NULL DEFAULT '{}',
  membership_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  package_ids uuid[] NOT NULL DEFAULT '{}',
  package_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.account_deletion_archives ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_deletion_archives FROM anon, authenticated;
GRANT ALL ON public.account_deletion_archives TO service_role;

CREATE OR REPLACE FUNCTION public.list_storage_objects_for_user(target uuid)
RETURNS TABLE (bucket_id text, name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = storage, public
AS $$
  SELECT objects.bucket_id::text, objects.name
  FROM storage.objects AS objects
  WHERE objects.owner = target
     OR objects.name = target::text
     OR objects.name LIKE target::text || '/%'
     OR objects.name LIKE '%/' || target::text || '/%';
$$;

REVOKE ALL ON FUNCTION public.list_storage_objects_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_storage_objects_for_user(uuid) TO service_role;
