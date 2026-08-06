-- Check if Arshdeep is marked as a tutor
-- Run this in Supabase SQL Editor or via psql

-- Find Arshdeep's profile
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.preferred_name,
  p.created_at
FROM profiles p
WHERE p.full_name ILIKE '%arshdeep%' 
   OR p.email ILIKE '%arshdeep%'
   OR p.preferred_name ILIKE '%arshdeep%';

-- Check their roles
SELECT 
  p.full_name,
  p.email,
  pr.role,
  pr.granted_at
FROM profiles p
LEFT JOIN profile_roles pr ON pr.user_id = p.id
WHERE p.full_name ILIKE '%arshdeep%' 
   OR p.email ILIKE '%arshdeep%'
   OR p.preferred_name ILIKE '%arshdeep%'
ORDER BY pr.granted_at;

-- Check if they have calendar connection
SELECT 
  p.full_name,
  p.email,
  tgcc.google_account_email,
  tgcc.connected_at,
  tgcc.last_synced_at,
  CASE 
    WHEN tgcc.token_expires_at > NOW() THEN 'Valid'
    WHEN tgcc.token_expires_at IS NULL THEN 'Not Connected'
    ELSE 'Expired'
  END as token_status
FROM profiles p
LEFT JOIN tutor_google_calendar_connections tgcc ON tgcc.tutor_id = p.id
WHERE p.full_name ILIKE '%arshdeep%' 
   OR p.email ILIKE '%arshdeep%'
   OR p.preferred_name ILIKE '%arshdeep%';
