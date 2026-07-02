-- =============================================================================
-- Kidda — Tutor availability, capacity, and member 1-to-1 bookings
-- Run after tutor-google-calendar.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.tutor_availability_settings (
  tutor_id                      UUID PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  timezone                      TEXT NOT NULL DEFAULT 'Europe/London',
  weekly_capacity_hours         NUMERIC(5, 2) NOT NULL DEFAULT 20
    CHECK (weekly_capacity_hours > 0 AND weekly_capacity_hours <= 168),
  default_session_minutes       INTEGER NOT NULL DEFAULT 60
    CHECK (default_session_minutes >= 15 AND default_session_minutes <= 240),
  booking_buffer_hours          INTEGER NOT NULL DEFAULT 24
    CHECK (booking_buffer_hours >= 0 AND booking_buffer_hours <= 168),
  buffer_between_sessions_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (buffer_between_sessions_minutes >= 0 AND buffer_between_sessions_minutes <= 120),
  one_to_one_booking_enabled    BOOLEAN NOT NULL DEFAULT false,
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tutor_availability_settings IS
  'Tutor weekly capacity, booking rules, and whether members can self-book 1-to-1 slots.';
COMMENT ON COLUMN public.tutor_availability_settings.weekly_capacity_hours IS
  'Total hours per week for all kid-related work (lessons, prep, admin, etc.).';
COMMENT ON COLUMN public.tutor_availability_settings.booking_buffer_hours IS
  'Minimum notice before a member can book (e.g. 24 = no same-day bookings).';

CREATE TABLE IF NOT EXISTS public.tutor_availability_windows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id      UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

COMMENT ON TABLE public.tutor_availability_windows IS
  'Recurring weekly windows when the tutor accepts new 1-to-1 bookings. day_of_week: 0=Mon … 6=Sun.';
CREATE INDEX IF NOT EXISTS idx_tutor_availability_windows_tutor
  ON public.tutor_availability_windows (tutor_id, day_of_week);

CREATE TABLE IF NOT EXISTS public.tutor_one_to_one_bookings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id                  UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  student_id                UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  starts_at                 TIMESTAMPTZ NOT NULL,
  ends_at                   TIMESTAMPTZ NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN ('pending_payment', 'confirmed', 'cancelled')),
  stripe_checkout_session_id TEXT,
  session_id                UUID REFERENCES public.tutor_scheduled_sessions (id) ON DELETE SET NULL,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

COMMENT ON TABLE public.tutor_one_to_one_bookings IS
  'Member-requested 1-to-1 slots. pending_payment until Stripe confirms; confirmed blocks the slot.';

CREATE UNIQUE INDEX IF NOT EXISTS tutor_one_to_one_bookings_slot_uq
  ON public.tutor_one_to_one_bookings (tutor_id, starts_at)
  WHERE status IN ('pending_payment', 'confirmed');

CREATE INDEX IF NOT EXISTS idx_tutor_one_to_one_bookings_student
  ON public.tutor_one_to_one_bookings (student_id, starts_at DESC);

CREATE INDEX IF NOT EXISTS idx_tutor_one_to_one_bookings_tutor_range
  ON public.tutor_one_to_one_bookings (tutor_id, starts_at)
  WHERE status IN ('pending_payment', 'confirmed');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.tutor_availability_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_availability_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_one_to_one_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors manage own availability settings" ON public.tutor_availability_settings;
CREATE POLICY "Tutors manage own availability settings"
  ON public.tutor_availability_settings FOR ALL TO authenticated
  USING (tutor_id = auth.uid() OR public.is_master_admin())
  WITH CHECK (tutor_id = auth.uid() OR public.is_master_admin());

DROP POLICY IF EXISTS "Students read tutor availability settings" ON public.tutor_availability_settings;
CREATE POLICY "Students read tutor availability settings"
  ON public.tutor_availability_settings FOR SELECT TO authenticated
  USING (
    one_to_one_booking_enabled = true
    OR tutor_id = auth.uid()
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Tutors manage own availability windows" ON public.tutor_availability_windows;
CREATE POLICY "Tutors manage own availability windows"
  ON public.tutor_availability_windows FOR ALL TO authenticated
  USING (tutor_id = auth.uid() OR public.is_master_admin())
  WITH CHECK (tutor_id = auth.uid() OR public.is_master_admin());

DROP POLICY IF EXISTS "Students read tutor availability windows" ON public.tutor_availability_windows;
CREATE POLICY "Students read tutor availability windows"
  ON public.tutor_availability_windows FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tutor_availability_settings s
      WHERE s.tutor_id = tutor_availability_windows.tutor_id
        AND s.one_to_one_booking_enabled = true
    )
    OR tutor_id = auth.uid()
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Students create own bookings" ON public.tutor_one_to_one_bookings;
CREATE POLICY "Students create own bookings"
  ON public.tutor_one_to_one_bookings FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students read own bookings" ON public.tutor_one_to_one_bookings;
CREATE POLICY "Students read own bookings"
  ON public.tutor_one_to_one_bookings FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR tutor_id = auth.uid()
    OR public.is_master_admin()
  );

DROP POLICY IF EXISTS "Students cancel own pending bookings" ON public.tutor_one_to_one_bookings;
CREATE POLICY "Students cancel own pending bookings"
  ON public.tutor_one_to_one_bookings FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending_payment')
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Tutors update own bookings" ON public.tutor_one_to_one_bookings;
CREATE POLICY "Tutors update own bookings"
  ON public.tutor_one_to_one_bookings FOR UPDATE TO authenticated
  USING (tutor_id = auth.uid() OR public.is_master_admin())
  WITH CHECK (tutor_id = auth.uid() OR public.is_master_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_availability_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_availability_windows TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tutor_one_to_one_bookings TO authenticated;

-- Paid session credits (member pays via Stripe, then books a slot)
CREATE TABLE IF NOT EXISTS public.tutor_one_to_one_booking_credits (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id                UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  stripe_checkout_session_id TEXT NOT NULL UNIQUE,
  status                    TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'used')),
  booking_id                UUID REFERENCES public.tutor_one_to_one_bookings (id) ON DELETE SET NULL,
  purchased_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at                   TIMESTAMPTZ
);

COMMENT ON TABLE public.tutor_one_to_one_booking_credits IS
  'One paid 1-to-1 session = one credit. Used when the member picks a calendar slot.';

CREATE INDEX IF NOT EXISTS idx_booking_credits_student_available
  ON public.tutor_one_to_one_booking_credits (student_id, purchased_at DESC)
  WHERE status = 'available';

ALTER TABLE public.tutor_one_to_one_booking_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students read own booking credits" ON public.tutor_one_to_one_booking_credits;
CREATE POLICY "Students read own booking credits"
  ON public.tutor_one_to_one_booking_credits FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_master_admin());

GRANT SELECT ON public.tutor_one_to_one_booking_credits TO authenticated;
GRANT ALL ON public.tutor_one_to_one_booking_credits TO service_role;

NOTIFY pgrst, 'reload schema';
