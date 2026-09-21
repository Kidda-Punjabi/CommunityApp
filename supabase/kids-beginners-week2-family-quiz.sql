-- =============================================================================
-- Kidda — Kids Beginners Course (Level 1) Week 2 public quiz (Family)
-- Additive only. Does not modify existing quizzes, questions, or form links.
-- =============================================================================

DO $$
DECLARE
  v_course_id UUID;
  v_quiz_id UUID;
  v_week2_lesson_id UUID := 'b9fad158-c3b4-48ee-b3e5-7969098ef121';
  v_adult_beginners_id UUID := '155d5df5-c442-4e95-a908-2a16fa2e8c8d';
  v_kids_beginners_id UUID := '9db3685b-15fe-41a3-b902-1c2db3000b33';
  v_adult_quiz_links INTEGER;
  v_quiz_link_count INTEGER;
  v_kids_quiz_count INTEGER;
  v_adult_quiz_count INTEGER;
BEGIN
  SELECT id INTO v_course_id
  FROM public.courses
  WHERE id = v_kids_beginners_id
    AND name = 'Kids Beginners Course (Level 1)';

  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Kids Beginners Course (Level 1) not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.quizzes
    WHERE course_id = v_course_id
      AND title = 'Week 2 Recap Quiz: Family'
  ) THEN
    RAISE EXCEPTION 'Quiz "Week 2 Recap Quiz: Family" already exists on Kids Beginners Course (Level 1)';
  END IF;

  INSERT INTO public.quizzes (title, course_id, level_number, lesson_id)
  SELECT 'Week 2 Recap Quiz: Family', v_course_id, 2, l.id
  FROM public.lessons l
  WHERE l.course_id = v_course_id
    AND l.lesson_number = 2
    AND l.id = v_week2_lesson_id
  RETURNING id INTO v_quiz_id;

  IF v_quiz_id IS NULL THEN
    RAISE EXCEPTION 'Kids Beginners Course (Level 1) week 2 Family lesson not found';
  END IF;

  INSERT INTO public.quiz_questions (
    quiz_id,
    question_text,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_answer,
    question_order,
    explanation
  )
  VALUES
    (
      v_quiz_id,
      'What does "bhra" mean?',
      'Sister',
      'Brother',
      'Mum',
      'Dad',
      'b',
      1,
      '"bhra" means "Brother."'
    ),
    (
      v_quiz_id,
      'What does "bhain" mean?',
      'Brother',
      'Grandfather',
      'Sister',
      'Aunty',
      'c',
      2,
      '"bhain" means "Sister."'
    ),
    (
      v_quiz_id,
      'How do you ask "Do you have a sister?"',
      'Tuhada koi bhra hai?',
      'Tuhadi koi bhain hai?',
      'Tuhade dad ki karde han?',
      'Tuhade bhra da naa ki hai?',
      'b',
      3,
      '"Tuhadi koi bhain hai?" is how you ask "Do you have a sister?"'
    ),
    (
      v_quiz_id,
      'What does "Tuhade bhra da naa ki hai?" mean?',
      'Do you have a brother?',
      'What does your dad do?',
      'What is your brother''s name?',
      'What is your sister''s name?',
      'c',
      4,
      '"Tuhade bhra da naa ki hai?" means "What is your brother''s name?"'
    ),
    (
      v_quiz_id,
      'Which sentence means "My sister''s name is Simran"?',
      'Mere bhra da naa Simran hai',
      'Meri bhain da naa Simran hai',
      'Tuhadi bhain da naa ki hai?',
      'Mera bhra hai',
      'b',
      5,
      '"Meri bhain da naa Simran hai" means "My sister''s name is Simran."'
    ),
    (
      v_quiz_id,
      'What does "Tuhade mummy ki karde han?" mean?',
      'Do you have a mum?',
      'What is your mum''s name?',
      'How old is your mum?',
      'What does your mum do?',
      'd',
      6,
      '"Tuhade mummy ki karde han?" means "What does your mum do?"'
    ),
    (
      v_quiz_id,
      '"Dada ji" is your...',
      'Dad''s father',
      'Mum''s father',
      'Dad''s sister',
      'Mum''s sister',
      'a',
      7,
      '"Dada ji" is your dad''s father.'
    ),
    (
      v_quiz_id,
      '"Naani ji" is your...',
      'Dad''s mother',
      'Dad''s sister',
      'Mum''s mother',
      'Mum''s sister',
      'c',
      8,
      '"Naani ji" is your mum''s mother.'
    ),
    (
      v_quiz_id,
      '"Mama ji" is your...',
      'Dad''s brother',
      'Dad''s sister',
      'Mum''s sister',
      'Mum''s brother',
      'd',
      9,
      '"Mama ji" is your mum''s brother.'
    ),
    (
      v_quiz_id,
      '"Bhua ji" is your...',
      'Mum''s sister',
      'Dad''s sister',
      'Mum''s brother',
      'Dad''s brother',
      'b',
      10,
      '"Bhua ji" is your dad''s sister.'
    );

  IF EXISTS (
    SELECT 1
    FROM public.public_form_links
    WHERE form_type = 'quiz'
      AND target_id = v_quiz_id::text
  ) THEN
    RAISE EXCEPTION 'public_form_links already has (form_type, target_id) for this quiz';
  END IF;

  INSERT INTO public.public_form_links (slug, form_type, target_id, label)
  VALUES (
    encode(extensions.gen_random_bytes(16), 'hex'),
    'quiz',
    v_quiz_id::text,
    'Week 2 Recap Quiz: Family'
  );

  SELECT count(*) INTO v_adult_quiz_links
  FROM public.public_form_links pfl
  JOIN public.quizzes q ON q.id::text = pfl.target_id
  WHERE pfl.form_type = 'quiz'
    AND q.course_id = v_adult_beginners_id;

  IF v_adult_quiz_links <> 14 THEN
    RAISE EXCEPTION 'Adult Beginners public quiz links changed: expected 14, found %', v_adult_quiz_links;
  END IF;

  SELECT count(*) INTO v_adult_quiz_count
  FROM public.quizzes
  WHERE course_id = v_adult_beginners_id;

  IF v_adult_quiz_count <> 14 THEN
    RAISE EXCEPTION 'Adult Beginners quizzes changed: expected 14, found %', v_adult_quiz_count;
  END IF;

  SELECT count(*) INTO v_kids_quiz_count
  FROM public.quizzes
  WHERE course_id = v_course_id;

  IF v_kids_quiz_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 Kids Beginners quizzes after insert, found %', v_kids_quiz_count;
  END IF;

  SELECT count(*) INTO v_quiz_link_count
  FROM public.public_form_links
  WHERE form_type = 'quiz';

  IF v_quiz_link_count <> 16 THEN
    RAISE EXCEPTION 'Expected 16 public quiz links after insert, found %', v_quiz_link_count;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
