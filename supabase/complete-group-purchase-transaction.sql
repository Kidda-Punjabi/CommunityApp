-- Atomic core steps for group checkout completion (member → enrollment → package → hold → checklist).
-- Side effects (Google Calendar, Notion, notifications) stay in app code after RPC succeeds.

CREATE OR REPLACE FUNCTION public.complete_group_purchase_core(
  p_user_id uuid,
  p_student_package_id uuid,
  p_cohort_id uuid,
  p_hold_id uuid,
  p_purchased_at timestamptz,
  p_payment_date date,
  p_stripe_session_id text,
  p_stripe_payment_intent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sp public.student_packages%ROWTYPE;
  v_pkg_delivery text;
  v_hold public.cohort_seat_holds%ROWTYPE;
  v_cohort public.cohorts%ROWTYPE;
  v_enrollment_id uuid;
  v_checklist_id uuid;
BEGIN
  SELECT sp.*
  INTO v_sp
  FROM public.student_packages sp
  WHERE sp.id = p_student_package_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Student package not found.');
  END IF;

  IF v_sp.user_id <> p_user_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Student package mismatch.');
  END IF;

  SELECT p.delivery_mode::text
  INTO v_pkg_delivery
  FROM public.packages p
  WHERE p.id = v_sp.package_id;

  IF v_pkg_delivery IS DISTINCT FROM 'group' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a group package.');
  END IF;

  IF v_sp.status = 'confirmed' AND v_sp.enrollment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok',
      true,
      'already_completed',
      true,
      'enrollment_id',
      v_sp.enrollment_id
    );
  END IF;

  SELECT *
  INTO v_hold
  FROM public.cohort_seat_holds
  WHERE id = p_hold_id
  FOR UPDATE;

  IF NOT FOUND
    OR v_hold.user_id <> p_user_id
    OR v_hold.cohort_id <> p_cohort_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cohort seat hold is invalid for this checkout.');
  END IF;

  SELECT *
  INTO v_cohort
  FROM public.cohorts
  WHERE id = p_cohort_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cohort not found.');
  END IF;

  INSERT INTO public.cohort_members (cohort_id, user_id, joined_at, left_at)
  VALUES (p_cohort_id, p_user_id, p_purchased_at, NULL)
  ON CONFLICT (cohort_id, user_id) DO UPDATE
  SET joined_at = EXCLUDED.joined_at,
      left_at = NULL;

  INSERT INTO public.course_enrollments (
    user_id,
    course_id,
    tutor_id,
    delivery_mode,
    cohort_id,
    student_package_id,
    updated_at
  )
  VALUES (
    p_user_id,
    v_cohort.course_id,
    v_cohort.tutor_id,
    'group'::public.delivery_mode,
    p_cohort_id,
    p_student_package_id,
    p_purchased_at
  )
  ON CONFLICT (user_id, course_id) DO UPDATE
  SET tutor_id = EXCLUDED.tutor_id,
      delivery_mode = EXCLUDED.delivery_mode,
      cohort_id = EXCLUDED.cohort_id,
      student_package_id = EXCLUDED.student_package_id,
      updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_enrollment_id;

  UPDATE public.student_packages
  SET status = 'confirmed',
      enrollment_id = v_enrollment_id,
      stripe_purchase_id = p_stripe_payment_intent,
      last_stripe_checkout_session_id = p_stripe_session_id,
      purchased_at = p_purchased_at
  WHERE id = p_student_package_id;

  DELETE FROM public.cohort_seat_holds
  WHERE id = p_hold_id;

  SELECT id INTO v_checklist_id
  FROM public.onboarding_checklists
  WHERE student_package_id = p_student_package_id;

  IF v_checklist_id IS NOT NULL THEN
    UPDATE public.onboarding_checklists
    SET checklist_type = 'group',
        payment_date = p_payment_date,
        time_assigned = true,
        package_created = true
    WHERE id = v_checklist_id;
  ELSE
    INSERT INTO public.onboarding_checklists (
      student_package_id,
      checklist_type,
      payment_date,
      time_assigned,
      package_created,
      welcome_email,
      calendar_invite,
      tutor_notified,
      whatsapp_chat_made,
      schedule_whatsapp_chat,
      onboarding_completed
    )
    VALUES (
      p_student_package_id,
      'group',
      p_payment_date,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false
    );
  END IF;

  RETURN jsonb_build_object(
    'ok',
    true,
    'enrollment_id',
    v_enrollment_id,
    'cohort_name',
    v_cohort.name,
    'notion_page_id',
    v_cohort.notion_page_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

COMMENT ON FUNCTION public.complete_group_purchase_core IS
  'Single-transaction group purchase placement: cohort member, enrollment, confirmed package, hold consumption, onboarding flags.';

GRANT EXECUTE ON FUNCTION public.complete_group_purchase_core TO service_role;
