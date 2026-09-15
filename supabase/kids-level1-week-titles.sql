-- Kids Level 1 (Kids Beginners Course) week titles.
-- Only this course: content_track=kids, 12 lessons. Adult Beginners is not touched.
DO $$
DECLARE
  v_course_id uuid := '9db3685b-15fe-41a3-b902-1c2db3000b33';
  v_name text;
  v_track text;
  v_count integer;
BEGIN
  SELECT name, content_track INTO v_name, v_track
  FROM public.courses
  WHERE id = v_course_id;

  IF v_name IS DISTINCT FROM 'Kids Beginners Course'
     OR v_track IS DISTINCT FROM 'kids' THEN
    RAISE EXCEPTION 'Refusing to retitle: expected Kids Beginners Course (kids), got % (%)',
      v_name, v_track;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.lessons
  WHERE course_id = v_course_id;

  IF v_count IS DISTINCT FROM 12 THEN
    RAISE EXCEPTION 'Refusing to retitle: expected 12 lessons, got %', v_count;
  END IF;

  UPDATE public.lessons SET title = 'Greetings & Introductions - Week 1'
    WHERE course_id = v_course_id AND lesson_number = 1;
  UPDATE public.lessons SET title = 'Family - Week 2'
    WHERE course_id = v_course_id AND lesson_number = 2;
  UPDATE public.lessons SET title = 'Basic Needs - Week 3'
    WHERE course_id = v_course_id AND lesson_number = 3;
  UPDATE public.lessons SET title = 'Numbers - Week 4'
    WHERE course_id = v_course_id AND lesson_number = 4;
  UPDATE public.lessons SET title = 'Colours - Week 5'
    WHERE course_id = v_course_id AND lesson_number = 5;
  UPDATE public.lessons SET title = 'Food - Week 6'
    WHERE course_id = v_course_id AND lesson_number = 6;
  UPDATE public.lessons SET title = 'Ability - Week 7'
    WHERE course_id = v_course_id AND lesson_number = 7;
  UPDATE public.lessons SET title = 'Hobbies - Week 8'
    WHERE course_id = v_course_id AND lesson_number = 8;
  UPDATE public.lessons SET title = 'Routine - Week 9'
    WHERE course_id = v_course_id AND lesson_number = 9;
  UPDATE public.lessons SET title = 'Imperatives and Position - Week 10'
    WHERE course_id = v_course_id AND lesson_number = 10;
  UPDATE public.lessons SET title = 'Recap - Week 11'
    WHERE course_id = v_course_id AND lesson_number = 11;
  UPDATE public.lessons SET title = 'Conversation - Week 12'
    WHERE course_id = v_course_id AND lesson_number = 12;
END $$;

NOTIFY pgrst, 'reload schema';
