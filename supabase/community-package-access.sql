-- =============================================================================
-- Kidda — Community package: sync course_access from student_packages membership
-- Run in Supabase SQL Editor after student-packages.sql and cohort revamp.
-- Safe to re-run.
-- =============================================================================

-- Backfill course_access for confirmed community memberships
INSERT INTO public.course_access (user_id, course_id, granted_at)
SELECT sp.user_id, sp.course_id, COALESCE(sp.purchased_at, now())
FROM public.student_packages sp
JOIN public.packages p ON p.id = sp.package_id
WHERE p.slug = 'community'
  AND sp.package_instance_id IS NULL
  AND sp.status = 'confirmed'::public.package_membership_status
ON CONFLICT (user_id, course_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_community_course_access_from_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_course_id uuid;
BEGIN
  SELECT p.slug, p.course_id
  INTO v_slug, v_course_id
  FROM public.packages p
  WHERE p.id = COALESCE(NEW.package_id, OLD.package_id);

  IF v_slug IS DISTINCT FROM 'community' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.course_access
    WHERE user_id = OLD.user_id
      AND course_id = OLD.course_id;
    RETURN OLD;
  END IF;

  IF NEW.status = 'confirmed'::public.package_membership_status THEN
    INSERT INTO public.course_access (user_id, course_id, granted_at)
    VALUES (NEW.user_id, NEW.course_id, COALESCE(NEW.purchased_at, now()))
    ON CONFLICT (user_id, course_id) DO NOTHING;
  ELSE
    DELETE FROM public.course_access
    WHERE user_id = NEW.user_id
      AND course_id = NEW.course_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_community_course_access ON public.student_packages;
CREATE TRIGGER trg_sync_community_course_access
  AFTER INSERT OR UPDATE OF status, package_id, course_id OR DELETE
  ON public.student_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_community_course_access_from_membership();

NOTIFY pgrst, 'reload schema';
