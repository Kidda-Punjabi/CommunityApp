-- =============================================================================
-- Kidda — Table grants for Supabase API roles
-- Run the ENTIRE file in Supabase SQL Editor if you see:
-- "permission denied for table …" on courses, lessons, quizzes, etc.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Member read access
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;

-- Authenticated write (also used if admin RLS policies allow)
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Service role (admin CMS server actions) — full access, bypasses RLS
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Sequences (auto-increment ids)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Future tables get the same grants automatically
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
