-- Store avatar object paths instead of public Storage URLs.
-- Legacy notification JSON is left unchanged; the app still accepts those URLs.

UPDATE public.profiles
SET avatar_url = substring(avatar_url FROM '/storage/v1/object/public/avatars/([^?#]+)')
WHERE avatar_url ~ '/storage/v1/object/public/avatars/[^?#]+';

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{avatar_url}',
  to_jsonb(substring(raw_user_meta_data->>'avatar_url' FROM '/storage/v1/object/public/avatars/([^?#]+)'))
)
WHERE COALESCE(raw_user_meta_data->>'avatar_url', '') ~ '/storage/v1/object/public/avatars/';

NOTIFY pgrst, 'reload schema';
