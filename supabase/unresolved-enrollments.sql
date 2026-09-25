-- Unresolved enrollments: resolution log, back-pointer safety, list + admin actions.
-- Append-only. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.enrollment_resolution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  notion_lead_page_id text,
  cohort_id uuid,
  package_instance_id uuid,
  kid_profile_id uuid,
  action text NOT NULL,
  note text,
  resolved_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_resolution_log_target CHECK (
    cohort_id IS NOT NULL OR package_instance_id IS NOT NULL
  ),
  CONSTRAINT enrollment_resolution_log_person CHECK (
    user_id IS NOT NULL OR notion_lead_page_id IS NOT NULL OR kid_profile_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS enrollment_resolution_log_lookup
  ON public.enrollment_resolution_log (cohort_id, package_instance_id, action);

ALTER TABLE public.enrollment_resolution_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS enrollment_resolution_log_admin_read ON public.enrollment_resolution_log;
CREATE POLICY enrollment_resolution_log_admin_read
  ON public.enrollment_resolution_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Keep course_enrollments.student_package_id set whenever a package points at an enrollment.
CREATE OR REPLACE FUNCTION public.sync_enrollment_student_package_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.enrollment_id IS NOT NULL THEN
    UPDATE public.course_enrollments
    SET student_package_id = NEW.id
    WHERE id = NEW.enrollment_id
      AND (student_package_id IS NULL OR student_package_id = NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_enrollment_student_package_id ON public.student_packages;
CREATE TRIGGER trg_sync_enrollment_student_package_id
  AFTER INSERT OR UPDATE OF enrollment_id ON public.student_packages
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_enrollment_student_package_id();

CREATE OR REPLACE FUNCTION public.assert_unresolved_enrollment_reader()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin')
     OR public.is_admin()
     OR EXISTS (
       SELECT 1 FROM public.profile_roles
       WHERE user_id = auth.uid() AND role::text = 'master_admin'
     )
  THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Not an admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_unresolved_enrollment_actor(p_actor uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'Not an admin';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = p_actor
      AND (
        coalesce(u.raw_app_meta_data ->> 'role', '') = 'admin'
        OR EXISTS (
          SELECT 1 FROM public.profile_roles pr
          WHERE pr.user_id = u.id AND pr.role::text = 'master_admin'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Not an admin';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unresolved_enrollment_rows()
RETURNS TABLE (
  row_key text,
  category text,
  target_kind text,
  target_id uuid,
  target_name text,
  target_status text,
  person_name text,
  email text,
  user_id uuid,
  notion_lead_page_id text,
  notion_package_page_id text,
  kid_profile_id uuid,
  detail text,
  kids jsonb,
  duplicate_accounts jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.assert_unresolved_enrollment_reader();

  RETURN QUERY
  WITH scope_cohorts AS (
    SELECT
      c.id,
      c.name,
      c.status::text AS status,
      c.notion_page_id,
      c.course_id,
      c.tutor_id,
      coalesce(co.content_track, '') = 'kids' AS is_kids,
      (
        SELECT p.id
        FROM public.packages p
        WHERE p.course_id = c.course_id AND p.delivery_mode::text = 'group'
        ORDER BY p.display_order NULLS LAST
        LIMIT 1
      ) AS expected_package_id
    FROM public.cohorts c
    JOIN public.courses co ON co.id = c.course_id
    WHERE c.active
      AND c.status::text IN ('recruiting', 'scheduled', 'in_progress', 'paused')
      AND c.name NOT ILIKE 'TEST DELETE%'
  ),
  scope_instances AS (
    SELECT
      pi.id,
      pi.name,
      pi.status::text AS status,
      pi.notion_page_id,
      pi.course_id,
      pi.tutor_id,
      pi.package_id,
      pi.app_access_expected
    FROM public.package_instances pi
    JOIN public.packages pkg ON pkg.id = pi.package_id
    WHERE pi.active
      AND pi.status::text IN ('recruiting', 'scheduled', 'in_progress', 'paused')
      AND pi.name NOT ILIKE 'TEST DELETE%'
      AND pkg.slug IS DISTINCT FROM 'community'
  ),
  cohort_inbox AS (
    SELECT sc.*, i.raw_properties
    FROM scope_cohorts sc
    JOIN public.notion_sync_inbox i
      ON replace(lower(i.notion_page_id), '-', '') = replace(lower(sc.notion_page_id), '-', '')
  ),
  instance_inbox AS (
    SELECT si.*, i.raw_properties
    FROM scope_instances si
    JOIN public.notion_sync_inbox i
      ON replace(lower(i.notion_page_id), '-', '') = replace(lower(si.notion_page_id), '-', '')
  ),
  cohort_confirmed AS (
    SELECT
      ib.id AS target_id,
      ib.notion_page_id,
      replace(lower(rel ->> 'id'), '-', '') AS lead_key,
      rel ->> 'id' AS lead_id
    FROM cohort_inbox ib
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(ib.raw_properties -> 'Confirmed' -> 'relation', '[]'::jsonb)) rel
    WHERE nullif(rel ->> 'id', '') IS NOT NULL
  ),
  instance_confirmed AS (
    SELECT
      ib.id AS target_id,
      replace(lower(rel ->> 'id'), '-', '') AS lead_key,
      rel ->> 'id' AS lead_id
    FROM instance_inbox ib
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(ib.raw_properties -> 'Confirmed' -> 'relation', '[]'::jsonb)) rel
    WHERE nullif(rel ->> 'id', '') IS NOT NULL
      AND ib.app_access_expected
  ),
  lead_match AS (
    SELECT
      cf.target_id,
      cf.lead_key,
      cf.lead_id,
      l.name AS lead_name,
      lower(trim(l.email)) AS email,
      p.id AS linked_user_id,
      u.id AS email_user_id,
      coalesce(p.id, u.id) AS user_id,
      (p.id IS NOT NULL) AS linked
    FROM (
      SELECT target_id, lead_key, lead_id FROM cohort_confirmed
      UNION ALL
      SELECT target_id, lead_key, lead_id FROM instance_confirmed
    ) cf
    LEFT JOIN public.notion_leads_cache l
      ON replace(lower(l.notion_page_id), '-', '') = cf.lead_key
    LEFT JOIN public.profiles p
      ON replace(lower(p.notion_lead_page_id), '-', '') = cf.lead_key
    LEFT JOIN auth.users u
      ON lower(trim(u.email)) = lower(trim(l.email))
  ),
  adult_confirmed AS (
    SELECT DISTINCT ON (lm.target_id, coalesce(lm.user_id::text, lm.lead_key))
      lm.*
    FROM lead_match lm
    JOIN scope_cohorts sc ON sc.id = lm.target_id AND NOT sc.is_kids
    ORDER BY lm.target_id, coalesce(lm.user_id::text, lm.lead_key), lm.linked DESC
  ),
  adult_app AS (
    SELECT
      m.cohort_id AS target_id,
      m.user_id,
      pr.full_name AS lead_name,
      lower(trim(au.email)) AS email,
      pr.notion_lead_page_id AS lead_id,
      true AS linked
    FROM cohort_inbox ib
    JOIN scope_cohorts sc ON sc.id = ib.id AND NOT sc.is_kids
    JOIN public.cohort_members m
      ON m.cohort_id = ib.id AND m.left_at IS NULL AND m.kid_profile_id IS NULL AND m.user_id IS NOT NULL
    JOIN public.profiles pr ON pr.id = m.user_id
    LEFT JOIN auth.users au ON au.id = m.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM adult_confirmed ac
      WHERE ac.target_id = m.cohort_id AND ac.user_id = m.user_id
    )
  ),
  adult_people AS (
    SELECT target_id, user_id, lead_name, email, lead_id, linked, true AS in_confirmed
    FROM adult_confirmed
    UNION ALL
    SELECT target_id, user_id, lead_name, email, lead_id, linked, false AS in_confirmed
    FROM adult_app
  ),
  adult_flags AS (
    SELECT
      ap.*,
      sc.name AS target_name,
      sc.status AS target_status,
      sc.notion_page_id,
      sc.course_id,
      sc.expected_package_id,
      pr.full_name,
      EXISTS (
        SELECT 1 FROM public.cohort_members m
        WHERE m.cohort_id = ap.target_id AND m.user_id = ap.user_id
          AND m.left_at IS NULL AND m.kid_profile_id IS NULL
      ) AS has_member,
      EXISTS (
        SELECT 1 FROM public.course_enrollments e
        WHERE e.user_id = ap.user_id AND e.course_id = sc.course_id
          AND e.kid_profile_id IS NULL AND e.cohort_id = ap.target_id
      ) AS has_enr_here,
      EXISTS (
        SELECT 1 FROM public.course_enrollments e
        WHERE e.user_id = ap.user_id AND e.course_id = sc.course_id
          AND e.kid_profile_id IS NULL AND e.cohort_id IS DISTINCT FROM ap.target_id
      ) AS has_enr_elsewhere,
      EXISTS (
        SELECT 1
        FROM public.course_enrollments e
        JOIN public.student_packages sp ON sp.id = e.student_package_id
        WHERE e.user_id = ap.user_id AND e.course_id = sc.course_id
          AND e.kid_profile_id IS NULL AND e.cohort_id = ap.target_id
          AND sp.status::text = 'confirmed'
          AND sp.package_id = sc.expected_package_id
          AND sp.enrollment_id = e.id
      ) AS pkg_ok,
      EXISTS (
        SELECT 1 FROM public.course_access ca
        WHERE ca.user_id = ap.user_id AND ca.course_id = sc.course_id AND ca.kid_profile_id IS NULL
      ) AS has_access,
      (
        SELECT other.id
        FROM public.profiles other
        WHERE other.id IS DISTINCT FROM ap.user_id
          AND other.full_name ILIKE coalesce(pr.full_name, ap.lead_name)
          AND length(trim(coalesce(pr.full_name, ap.lead_name, ''))) > 0
          AND (
            EXISTS (
              SELECT 1 FROM public.cohort_members om
              WHERE om.user_id = other.id AND om.cohort_id = ap.target_id
                AND om.left_at IS NULL AND om.kid_profile_id IS NULL
            )
            OR EXISTS (
              SELECT 1 FROM public.course_enrollments oe
              WHERE oe.user_id = other.id AND oe.cohort_id = ap.target_id AND oe.kid_profile_id IS NULL
            )
          )
        LIMIT 1
      ) AS other_user_id
    FROM adult_people ap
    JOIN scope_cohorts sc ON sc.id = ap.target_id
    LEFT JOIN public.profiles pr ON pr.id = ap.user_id
  ),
  adult_labeled AS (
    SELECT
      af.*,
      CASE
        WHEN af.has_member AND af.has_enr_here AND af.pkg_ok AND af.has_access AND af.in_confirmed THEN 'ok'
        WHEN af.has_member AND af.has_enr_here AND af.pkg_ok AND af.has_access AND NOT af.in_confirmed THEN 'E'
        WHEN af.user_id IS NULL AND af.in_confirmed THEN 'C'
        WHEN af.user_id IS NOT NULL AND NOT af.has_member AND NOT af.has_enr_here
             AND NOT af.has_enr_elsewhere AND NOT af.pkg_ok AND af.other_user_id IS NOT NULL AND af.in_confirmed THEN 'G'
        WHEN af.user_id IS NOT NULL AND NOT af.has_member AND NOT af.has_enr_here
             AND NOT af.has_enr_elsewhere AND NOT af.pkg_ok AND af.linked AND af.in_confirmed THEN 'A'
        WHEN af.user_id IS NOT NULL AND NOT af.has_member AND NOT af.has_enr_here
             AND NOT af.has_enr_elsewhere AND NOT af.pkg_ok AND af.in_confirmed THEN 'B'
        WHEN af.has_member OR af.has_enr_here OR af.has_enr_elsewhere OR af.pkg_ok OR af.has_access THEN 'D'
        ELSE 'ok'
      END AS category
    FROM adult_flags af
  ),
  instance_packages AS (
    SELECT
      si.id AS target_id,
      si.name AS target_name,
      si.status AS target_status,
      si.notion_page_id,
      si.course_id,
      si.package_id,
      sp.user_id,
      sp.id AS student_package_id,
      sp.status::text AS package_status,
      sp.enrollment_id,
      pr.full_name,
      lower(trim(au.email)) AS email,
      pr.notion_lead_page_id AS lead_id,
      (e.id IS NOT NULL AND e.student_package_id = sp.id AND sp.enrollment_id = e.id
        AND e.cohort_id IS NULL AND e.kid_profile_id IS NULL) AS linked_both,
      EXISTS (
        SELECT 1 FROM public.course_access ca
        WHERE ca.user_id = sp.user_id AND ca.course_id = si.course_id AND ca.kid_profile_id IS NULL
      ) AS has_access,
      pkg.name AS package_name
    FROM scope_instances si
    JOIN public.student_packages sp
      ON sp.package_instance_id = si.id AND sp.kid_profile_id IS NULL AND sp.user_id IS NOT NULL
    LEFT JOIN public.course_enrollments e ON e.id = sp.enrollment_id
    LEFT JOIN public.profiles pr ON pr.id = sp.user_id
    LEFT JOIN auth.users au ON au.id = sp.user_id
    LEFT JOIN public.packages pkg ON pkg.id = sp.package_id
  ),
  kids_confirmed AS (
    SELECT
      lm.*,
      sc.name AS target_name,
      sc.status AS target_status,
      sc.notion_page_id,
      sc.id AS cohort_id
    FROM lead_match lm
    JOIN scope_cohorts sc ON sc.id = lm.target_id AND sc.is_kids
  ),
  kids_email_dupes AS (
    SELECT kc.cohort_id, kc.email
    FROM kids_confirmed kc
    WHERE kc.email IS NOT NULL AND kc.email <> ''
    GROUP BY kc.cohort_id, kc.email
    HAVING count(DISTINCT kc.lead_key) > 1
  ),
  kids_parent AS (
    SELECT
      kc.*,
      EXISTS (
        SELECT 1 FROM kids_email_dupes d
        WHERE d.cohort_id = kc.cohort_id AND d.email = kc.email
      ) AS email_shared,
      EXISTS (
        SELECT 1
        FROM public.kid_profiles kp
        JOIN public.cohort_members m
          ON m.kid_profile_id = kp.id AND m.cohort_id = kc.cohort_id AND m.left_at IS NULL
        WHERE kp.parent_user_id = kc.user_id
      ) AS covered
    FROM kids_confirmed kc
  ),
  kids_left AS (
    SELECT
      sc.id AS target_id,
      sc.name AS target_name,
      sc.status AS target_status,
      sc.notion_page_id,
      kp.id AS kid_profile_id,
      kp.name AS kid_name,
      kp.parent_user_id,
      pr.full_name AS parent_name,
      lower(trim(au.email)) AS email,
      pr.notion_lead_page_id AS lead_id
    FROM scope_cohorts sc
    JOIN public.course_enrollments e
      ON e.cohort_id = sc.id AND e.kid_profile_id IS NOT NULL
    JOIN public.kid_profiles kp ON kp.id = e.kid_profile_id
    LEFT JOIN public.profiles pr ON pr.id = kp.parent_user_id
    LEFT JOIN auth.users au ON au.id = kp.parent_user_id
    WHERE sc.is_kids
      AND EXISTS (
        SELECT 1 FROM public.cohort_members m
        WHERE m.cohort_id = sc.id AND m.kid_profile_id = kp.id AND m.left_at IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.cohort_members m
        WHERE m.cohort_id = sc.id AND m.kid_profile_id = kp.id AND m.left_at IS NULL
      )
  ),
  rows AS (
    SELECT
      ('cohort|' || al.target_id::text || '|' || coalesce(al.user_id::text, al.lead_id, al.lead_name)) AS row_key,
      al.category,
      'cohort'::text AS target_kind,
      al.target_id,
      al.target_name,
      al.target_status,
      coalesce(al.full_name, al.lead_name, 'Unnamed') AS person_name,
      al.email,
      al.user_id,
      al.lead_id AS notion_lead_page_id,
      al.notion_page_id AS notion_package_page_id,
      NULL::uuid AS kid_profile_id,
      concat_ws(
        '; ',
        CASE WHEN al.category = 'E' THEN 'In the cohort, not in Notion Confirmed' END,
        CASE WHEN NOT al.has_member AND al.category = 'D' THEN 'No active membership' END,
        CASE WHEN al.has_enr_elsewhere THEN 'Enrollment is on a different cohort' END,
        CASE WHEN al.category = 'D' AND NOT al.has_enr_here AND NOT al.has_enr_elsewhere THEN 'No enrollment' END,
        CASE WHEN al.category = 'D' AND al.has_enr_here AND NOT al.pkg_ok THEN 'Package missing, not confirmed, or not linked' END,
        CASE WHEN al.category = 'D' AND NOT al.has_access THEN 'No course access' END,
        CASE WHEN al.category = 'A' THEN 'Confirmed in Notion, app account exists, not enrolled' END,
        CASE WHEN al.category = 'B' THEN 'Confirmed in Notion, email matches an account, App User ID is blank' END,
        CASE WHEN al.category = 'C' THEN 'Confirmed in Notion, no app account' END,
        CASE WHEN al.category = 'G' THEN 'Another account with the same name is already on this cohort' END
      ) AS detail,
      NULL::jsonb AS kids,
      CASE
        WHEN al.category = 'G' THEN jsonb_build_object(
          'this', jsonb_build_object(
            'user_id', al.user_id,
            'email', al.email,
            'full_name', al.full_name,
            'created_at', (SELECT au.created_at FROM auth.users au WHERE au.id = al.user_id),
            'enrolled_in', public.enrollment_account_summary(al.user_id)
          ),
          'other', jsonb_build_object(
            'user_id', al.other_user_id,
            'email', (SELECT lower(trim(au.email)) FROM auth.users au WHERE au.id = al.other_user_id),
            'full_name', (SELECT pr.full_name FROM public.profiles pr WHERE pr.id = al.other_user_id),
            'created_at', (SELECT au.created_at FROM auth.users au WHERE au.id = al.other_user_id),
            'enrolled_in', public.enrollment_account_summary(al.other_user_id)
          )
        )
        ELSE NULL
      END AS duplicate_accounts
    FROM adult_labeled al
    WHERE al.category <> 'ok'

    UNION ALL

    SELECT
      ('instance|' || ip.target_id::text || '|' || ip.user_id::text),
      'D',
      'package_instance',
      ip.target_id,
      ip.target_name,
      ip.target_status,
      coalesce(ip.full_name, 'Unnamed'),
      ip.email,
      ip.user_id,
      ip.lead_id,
      ip.notion_page_id,
      NULL,
      concat_ws(
        '; ',
        CASE WHEN ip.package_status IS DISTINCT FROM 'confirmed' THEN 'Package status is ' || ip.package_status END,
        CASE WHEN NOT ip.linked_both THEN 'Enrollment missing or package not linked' END,
        CASE WHEN NOT ip.has_access THEN 'No course access' END
      ),
      NULL,
      NULL
    FROM instance_packages ip
    WHERE NOT (
      ip.package_status = 'confirmed' AND ip.linked_both AND ip.has_access
    )

    UNION ALL

    SELECT
      ('kids|' || kp.cohort_id::text || '|' || kp.lead_key),
      CASE
        WHEN kp.email_shared AND NOT kp.linked THEN 'H'
        WHEN kp.email_shared AND kp.linked IS NOT TRUE AND kp.user_id IS NULL THEN 'H'
        WHEN NOT kp.covered AND kp.user_id IS NULL THEN 'C'
        WHEN NOT kp.covered AND kp.linked THEN 'A'
        WHEN NOT kp.covered THEN 'B'
        ELSE 'ok'
      END,
      'cohort',
      kp.cohort_id,
      kp.target_name,
      kp.target_status,
      coalesce(kp.lead_name, 'Unnamed parent'),
      kp.email,
      kp.linked_user_id,
      kp.lead_id,
      kp.notion_page_id,
      NULL,
      CASE
        WHEN kp.email_shared AND NOT kp.linked THEN 'Notion data issue: this lead shares an email with another Confirmed lead on the same package'
        WHEN NOT kp.covered AND kp.user_id IS NULL THEN 'Confirmed parent, no app account, no active child on this cohort'
        WHEN NOT kp.covered AND kp.linked THEN 'Confirmed parent, app account exists, no active child on this cohort'
        WHEN NOT kp.covered THEN 'Confirmed parent, email matches an account, App User ID is blank, no active child on this cohort'
        ELSE NULL
      END,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object('name', child.name, 'active', child.active) ORDER BY child.name), '[]'::jsonb)
        FROM (
          SELECT kp2.name, (m.left_at IS NULL) AS active
          FROM public.kid_profiles kp2
          LEFT JOIN public.cohort_members m
            ON m.kid_profile_id = kp2.id AND m.cohort_id = kp.cohort_id
          WHERE kp2.parent_user_id = kp.linked_user_id
            AND (m.id IS NOT NULL OR EXISTS (
              SELECT 1 FROM public.course_enrollments e
              WHERE e.kid_profile_id = kp2.id AND e.cohort_id = kp.cohort_id
            ))
        ) child
      ),
      NULL
    FROM kids_parent kp
    WHERE (kp.email_shared AND NOT kp.linked)
       OR (NOT kp.covered AND NOT (kp.email_shared AND NOT kp.linked))

    UNION ALL

    SELECT
      ('kid-left|' || kl.target_id::text || '|' || kl.kid_profile_id::text),
      'D',
      'cohort',
      kl.target_id,
      kl.target_name,
      kl.target_status,
      kl.kid_name,
      kl.email,
      kl.parent_user_id,
      kl.lead_id,
      kl.notion_page_id,
      kl.kid_profile_id,
      'Child left the cohort and the enrollment is still open. Close enrollment is waiting for confirmation that they withdrew.'
        || coalesce(' Parent: ' || kl.parent_name, ''),
      NULL,
      NULL
    FROM kids_left kl
  )
  SELECT
    r.row_key,
    r.category,
    r.target_kind,
    r.target_id,
    r.target_name,
    r.target_status,
    r.person_name,
    r.email,
    r.user_id,
    r.notion_lead_page_id,
    r.notion_package_page_id,
    r.kid_profile_id,
    r.detail,
    r.kids,
    r.duplicate_accounts
  FROM rows r
  WHERE r.category <> 'ok'
    AND NOT EXISTS (
      SELECT 1
      FROM public.enrollment_resolution_log l
      WHERE l.action IN ('dismiss', 'not_using_app')
        AND l.cohort_id IS NOT DISTINCT FROM CASE WHEN r.target_kind = 'cohort' THEN r.target_id END
        AND l.package_instance_id IS NOT DISTINCT FROM CASE WHEN r.target_kind = 'package_instance' THEN r.target_id END
        AND (
          (r.user_id IS NOT NULL AND l.user_id = r.user_id)
          OR (r.notion_lead_page_id IS NOT NULL AND replace(lower(l.notion_lead_page_id), '-', '') = replace(lower(r.notion_lead_page_id), '-', ''))
          OR (r.kid_profile_id IS NOT NULL AND l.kid_profile_id = r.kid_profile_id)
        )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.enrollment_account_summary(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(string_agg(label, ', ' ORDER BY label), 'Nothing active')
  FROM (
    SELECT c.name AS label
    FROM public.cohort_members m
    JOIN public.cohorts c ON c.id = m.cohort_id
    WHERE m.user_id = p_user_id AND m.left_at IS NULL AND m.kid_profile_id IS NULL
    UNION
    SELECT pi.name
    FROM public.student_packages sp
    JOIN public.package_instances pi ON pi.id = sp.package_instance_id
    WHERE sp.user_id = p_user_id AND sp.status::text = 'confirmed'
  ) labels;
$$;

CREATE OR REPLACE FUNCTION public.admin_unresolved_enrollment_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer FROM public.admin_unresolved_enrollment_rows();
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_unresolved_enrollment(
  p_actor uuid,
  p_action text,
  p_target_kind text,
  p_target_id uuid,
  p_user_id uuid,
  p_notion_lead_page_id text,
  p_kid_profile_id uuid,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_tutor_id uuid;
  v_package_id uuid;
  v_is_kids boolean;
  v_kid uuid;
  v_enrollment_id uuid;
  v_existing_cohort uuid;
  v_existing_package uuid;
  v_package_row uuid;
  v_package_enrollment uuid;
  v_note text;
BEGIN
  PERFORM public.assert_unresolved_enrollment_actor(p_actor);

  IF p_action = 'merge' THEN
    RAISE EXCEPTION 'Merge is not available yet';
  END IF;

  IF p_action IN ('dismiss', 'not_using_app') THEN
    v_note := nullif(trim(coalesce(p_note, '')), '');
    IF v_note IS NULL THEN
      RAISE EXCEPTION 'A note is required';
    END IF;
    IF p_user_id IS NULL AND nullif(trim(coalesce(p_notion_lead_page_id, '')), '') IS NULL AND p_kid_profile_id IS NULL THEN
      RAISE EXCEPTION 'A person is required';
    END IF;
    INSERT INTO public.enrollment_resolution_log (
      user_id, notion_lead_page_id, cohort_id, package_instance_id, kid_profile_id, action, note, resolved_by
    ) VALUES (
      p_user_id,
      nullif(trim(coalesce(p_notion_lead_page_id, '')), ''),
      CASE WHEN p_target_kind = 'cohort' THEN p_target_id END,
      CASE WHEN p_target_kind = 'package_instance' THEN p_target_id END,
      p_kid_profile_id,
      p_action,
      v_note,
      p_actor
    );
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action = 'cache_confirmed' THEN
    UPDATE public.notion_sync_inbox i
    SET raw_properties = jsonb_set(
      coalesce(i.raw_properties, '{}'::jsonb),
      '{Confirmed,relation}',
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object('id', id)), '[]'::jsonb)
        FROM (
          SELECT DISTINCT id
          FROM (
            SELECT rel ->> 'id' AS id
            FROM jsonb_array_elements(coalesce(i.raw_properties -> 'Confirmed' -> 'relation', '[]'::jsonb)) rel
            UNION ALL
            SELECT p_notion_lead_page_id
          ) ids
          WHERE nullif(id, '') IS NOT NULL
        ) deduped
      ),
      true
    )
    WHERE replace(lower(i.notion_page_id), '-', '') = replace(lower((
      SELECT notion_page_id FROM public.cohorts WHERE id = p_target_id AND p_target_kind = 'cohort'
      UNION ALL
      SELECT notion_page_id FROM public.package_instances WHERE id = p_target_id AND p_target_kind = 'package_instance'
      LIMIT 1
    )), '-', '');
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action = 'remove_member' THEN
    IF p_target_kind <> 'cohort' THEN
      RAISE EXCEPTION 'Remove from cohort only applies to a cohort';
    END IF;
    IF p_kid_profile_id IS NOT NULL THEN
      UPDATE public.cohort_members
      SET left_at = now()
      WHERE cohort_id = p_target_id AND kid_profile_id = p_kid_profile_id AND left_at IS NULL;
    ELSE
      UPDATE public.cohort_members
      SET left_at = now()
      WHERE cohort_id = p_target_id AND user_id = p_user_id AND kid_profile_id IS NULL AND left_at IS NULL;
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No active membership to remove';
    END IF;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action NOT IN ('enroll', 'repair') THEN
    RAISE EXCEPTION 'Unknown action %', p_action;
  END IF;

  IF p_notion_lead_page_id IS NOT NULL AND p_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET notion_lead_page_id = p_notion_lead_page_id
    WHERE id = p_user_id
      AND (
        notion_lead_page_id IS NULL
        OR replace(lower(notion_lead_page_id), '-', '') = replace(lower(p_notion_lead_page_id), '-', '')
      );
  END IF;

  IF p_target_kind = 'cohort' THEN
    SELECT c.course_id, c.tutor_id, coalesce(co.content_track, '') = 'kids',
      (
        SELECT p.id FROM public.packages p
        WHERE p.course_id = c.course_id AND p.delivery_mode::text = 'group'
        ORDER BY p.display_order NULLS LAST
        LIMIT 1
      )
    INTO v_course_id, v_tutor_id, v_is_kids, v_package_id
    FROM public.cohorts c
    JOIN public.courses co ON co.id = c.course_id
    WHERE c.id = p_target_id
      AND c.active
      AND c.status::text IN ('recruiting', 'scheduled', 'in_progress', 'paused')
      AND c.name NOT ILIKE 'TEST DELETE%';
    IF v_course_id IS NULL THEN
      RAISE EXCEPTION 'Cohort is not an active enrollment target';
    END IF;
    IF v_package_id IS NULL THEN
      RAISE EXCEPTION 'No group package product for this course';
    END IF;

    v_kid := p_kid_profile_id;
    IF v_is_kids AND v_kid IS NULL THEN
      SELECT kp.id INTO v_kid
      FROM public.kid_profiles kp
      WHERE kp.parent_user_id = p_user_id
      ORDER BY kp.created_at
      LIMIT 1;
      IF v_kid IS NULL THEN
        RAISE EXCEPTION 'No child profile is linked to this parent';
      END IF;
      IF (
        SELECT count(*) FROM public.kid_profiles kp WHERE kp.parent_user_id = p_user_id
      ) > 1 THEN
        RAISE EXCEPTION 'This parent has more than one child. Pick the child before enrolling';
      END IF;
    END IF;

    IF v_is_kids THEN
      INSERT INTO public.cohort_members (cohort_id, user_id, kid_profile_id, joined_at, left_at)
      VALUES (p_target_id, NULL, v_kid, now(), NULL)
      ON CONFLICT (cohort_id, kid_profile_id) DO UPDATE
      SET left_at = NULL;

      SELECT e.id, e.cohort_id INTO v_enrollment_id, v_existing_cohort
      FROM public.course_enrollments e
      WHERE e.kid_profile_id = v_kid AND e.course_id = v_course_id;
      IF v_existing_cohort IS NOT NULL AND v_existing_cohort IS DISTINCT FROM p_target_id THEN
        RAISE EXCEPTION 'This child is already enrolled on a different cohort';
      END IF;
      INSERT INTO public.course_enrollments (
        user_id, kid_profile_id, course_id, tutor_id, delivery_mode, cohort_id, updated_at
      ) VALUES (
        NULL, v_kid, v_course_id, v_tutor_id, 'group', p_target_id, now()
      )
      ON CONFLICT (kid_profile_id, course_id) DO UPDATE
      SET tutor_id = EXCLUDED.tutor_id,
          delivery_mode = EXCLUDED.delivery_mode,
          cohort_id = EXCLUDED.cohort_id,
          updated_at = now()
      RETURNING id INTO v_enrollment_id;

      INSERT INTO public.student_packages (
        user_id, kid_profile_id, package_id, course_id, status, enrollment_id, purchased_at
      ) VALUES (
        NULL, v_kid, v_package_id, v_course_id, 'confirmed', v_enrollment_id, now()
      )
      ON CONFLICT (kid_profile_id, package_id) DO UPDATE
      SET status = 'confirmed',
          enrollment_id = EXCLUDED.enrollment_id,
          updated_at = now()
      RETURNING id INTO v_package_row;

      UPDATE public.course_enrollments
      SET student_package_id = v_package_row
      WHERE id = v_enrollment_id
        AND (student_package_id IS NULL OR student_package_id = v_package_row);

      INSERT INTO public.course_access (user_id, course_id, kid_profile_id)
      SELECT NULL, v_course_id, v_kid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.course_access ca
        WHERE ca.kid_profile_id = v_kid AND ca.course_id = v_course_id
      );
    ELSE
      IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'An app account is required to enroll';
      END IF;
      INSERT INTO public.cohort_members (cohort_id, user_id, joined_at, left_at)
      VALUES (p_target_id, p_user_id, now(), NULL)
      ON CONFLICT (cohort_id, user_id) DO UPDATE
      SET left_at = NULL;

      SELECT e.id, e.cohort_id, e.student_package_id
      INTO v_enrollment_id, v_existing_cohort, v_existing_package
      FROM public.course_enrollments e
      WHERE e.user_id = p_user_id AND e.course_id = v_course_id AND e.kid_profile_id IS NULL;

      IF v_existing_cohort IS NOT NULL AND v_existing_cohort IS DISTINCT FROM p_target_id THEN
        RAISE EXCEPTION 'This account is already enrolled on a different cohort';
      END IF;
      IF v_existing_package IS NOT NULL AND v_existing_package IS DISTINCT FROM (
        SELECT sp.id FROM public.student_packages sp
        WHERE sp.user_id = p_user_id AND sp.package_id = v_package_id AND sp.kid_profile_id IS NULL
      ) AND EXISTS (
        SELECT 1 FROM public.student_packages sp
        WHERE sp.id = v_existing_package AND sp.package_id IS DISTINCT FROM v_package_id
      ) THEN
        RAISE EXCEPTION 'This enrollment is already linked to a different package';
      END IF;

      INSERT INTO public.course_enrollments (
        user_id, course_id, tutor_id, delivery_mode, cohort_id, updated_at
      ) VALUES (
        p_user_id, v_course_id, v_tutor_id, 'group', p_target_id, now()
      )
      ON CONFLICT (user_id, course_id) DO UPDATE
      SET tutor_id = EXCLUDED.tutor_id,
          delivery_mode = EXCLUDED.delivery_mode,
          cohort_id = EXCLUDED.cohort_id,
          updated_at = now()
      WHERE public.course_enrollments.cohort_id IS NULL
         OR public.course_enrollments.cohort_id = EXCLUDED.cohort_id
      RETURNING id INTO v_enrollment_id;

      SELECT sp.id, sp.enrollment_id INTO v_package_row, v_package_enrollment
      FROM public.student_packages sp
      WHERE sp.user_id = p_user_id AND sp.package_id = v_package_id AND sp.kid_profile_id IS NULL;

      IF v_package_enrollment IS NOT NULL AND v_package_enrollment IS DISTINCT FROM v_enrollment_id THEN
        RAISE EXCEPTION 'The group package is already linked to a different enrollment';
      END IF;

      INSERT INTO public.student_packages (
        user_id, package_id, course_id, status, enrollment_id, purchased_at
      ) VALUES (
        p_user_id, v_package_id, v_course_id, 'confirmed', v_enrollment_id, now()
      )
      ON CONFLICT (user_id, package_id) DO UPDATE
      SET status = 'confirmed',
          enrollment_id = EXCLUDED.enrollment_id,
          updated_at = now()
      RETURNING id INTO v_package_row;

      UPDATE public.course_enrollments
      SET student_package_id = v_package_row
      WHERE id = v_enrollment_id
        AND (student_package_id IS NULL OR student_package_id = v_package_row);

      INSERT INTO public.course_access (user_id, course_id, kid_profile_id)
      SELECT p_user_id, v_course_id, NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM public.course_access ca
        WHERE ca.user_id = p_user_id AND ca.course_id = v_course_id AND ca.kid_profile_id IS NULL
      );
    END IF;
  ELSIF p_target_kind = 'package_instance' THEN
    SELECT pi.course_id, pi.tutor_id, pi.package_id
    INTO v_course_id, v_tutor_id, v_package_id
    FROM public.package_instances pi
    WHERE pi.id = p_target_id
      AND pi.active
      AND pi.status::text IN ('recruiting', 'scheduled', 'in_progress', 'paused')
      AND pi.name NOT ILIKE 'TEST DELETE%';
    IF v_course_id IS NULL THEN
      RAISE EXCEPTION 'Package instance is not an active enrollment target';
    END IF;
    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'An app account is required to enroll';
    END IF;

    SELECT e.id, e.cohort_id, e.student_package_id
    INTO v_enrollment_id, v_existing_cohort, v_existing_package
    FROM public.course_enrollments e
    WHERE e.user_id = p_user_id AND e.course_id = v_course_id AND e.kid_profile_id IS NULL;

    IF v_existing_cohort IS NOT NULL THEN
      RAISE EXCEPTION 'This account is already enrolled on a group cohort for this course';
    END IF;

    INSERT INTO public.course_enrollments (
      user_id, course_id, tutor_id, delivery_mode, cohort_id, updated_at
    ) VALUES (
      p_user_id, v_course_id, v_tutor_id, 'one_to_one', NULL, now()
    )
    ON CONFLICT (user_id, course_id) DO UPDATE
    SET tutor_id = COALESCE(public.course_enrollments.tutor_id, EXCLUDED.tutor_id),
        delivery_mode = COALESCE(public.course_enrollments.delivery_mode, EXCLUDED.delivery_mode),
        updated_at = now()
    WHERE public.course_enrollments.cohort_id IS NULL
    RETURNING id INTO v_enrollment_id;

    SELECT sp.id, sp.enrollment_id INTO v_package_row, v_package_enrollment
    FROM public.student_packages sp
    WHERE sp.user_id = p_user_id AND sp.package_id = v_package_id AND sp.kid_profile_id IS NULL;

    IF v_package_enrollment IS NOT NULL AND v_enrollment_id IS NOT NULL
       AND v_package_enrollment IS DISTINCT FROM v_enrollment_id THEN
      RAISE EXCEPTION 'This package is already linked to a different enrollment';
    END IF;

    INSERT INTO public.student_packages (
      user_id, package_id, course_id, package_instance_id, status, enrollment_id, purchased_at
    ) VALUES (
      p_user_id, v_package_id, v_course_id, p_target_id, 'confirmed', v_enrollment_id, now()
    )
    ON CONFLICT (user_id, package_id) DO UPDATE
    SET status = 'confirmed',
        package_instance_id = EXCLUDED.package_instance_id,
        enrollment_id = EXCLUDED.enrollment_id,
        updated_at = now()
    RETURNING id INTO v_package_row;

    UPDATE public.course_enrollments
    SET student_package_id = v_package_row
    WHERE id = v_enrollment_id
      AND (student_package_id IS NULL OR student_package_id = v_package_row);

    INSERT INTO public.course_access (user_id, course_id, kid_profile_id)
    SELECT p_user_id, v_course_id, NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM public.course_access ca
      WHERE ca.user_id = p_user_id AND ca.course_id = v_course_id AND ca.kid_profile_id IS NULL
    );
  ELSE
    RAISE EXCEPTION 'Unknown target';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_unresolved_enrollment_rows() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_unresolved_enrollment_count() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_resolve_unresolved_enrollment(uuid, text, text, uuid, uuid, text, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_account_summary(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
