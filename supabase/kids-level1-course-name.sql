-- Rename Kids Level 1 course to include the level in courses.name.
-- Parentheses match existing naming (e.g. Beginners Course (Group)).
-- Adult courses and lesson titles are not touched.
DO $$
DECLARE
  v_course_id uuid := '9db3685b-15fe-41a3-b902-1c2db3000b33';
  v_name text;
  v_track text;
BEGIN
  SELECT name, content_track INTO v_name, v_track
  FROM public.courses
  WHERE id = v_course_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Kids Level 1 course % not found', v_course_id;
  END IF;

  IF v_track IS DISTINCT FROM 'kids' THEN
    RAISE EXCEPTION 'Refusing to rename: expected content_track=kids, got %', v_track;
  END IF;

  IF v_name IS DISTINCT FROM 'Kids Beginners Course'
     AND v_name IS DISTINCT FROM 'Kids Beginners Course (Level 1)' THEN
    RAISE EXCEPTION 'Refusing to rename: unexpected current name %', v_name;
  END IF;

  UPDATE public.courses
  SET name = 'Kids Beginners Course (Level 1)'
  WHERE id = v_course_id;
END $$;

NOTIFY pgrst, 'reload schema';
