-- Required community introduction post (forum onboarding).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_completed_community_intro BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.has_completed_community_intro IS
  'True once the user has posted their required forum introduction post.';
