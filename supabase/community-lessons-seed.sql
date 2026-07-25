-- =============================================================================
-- Kidda — Community course: 24 weeks (lessons) with Canva presentation links
-- Run AFTER: courses-seed.sql, lesson-presentations.sql
-- Idempotent: updates existing rows by lesson_number, inserts missing weeks.
-- Access: Practical Punjabi weeks are free lessons (is_free = true) for the Learn Free track.
-- =============================================================================

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS presentation_url TEXT;

-- Ensure the Community course row exists
INSERT INTO public.courses (name, description, display_order, required_tier)
SELECT
  'Kidda Community',
  'Live sessions, advanced content, and the full Kidda community.',
  3,
  'community'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.courses AS c
  WHERE c.required_tier = 'community'
     OR c.name ILIKE '%community%'
);

-- Canonical community course (prefer required_tier match, then lowest display_order)
WITH community_course AS (
  SELECT c.id
  FROM public.courses AS c
  WHERE c.required_tier = 'community'
     OR c.name ILIKE '%community%'
  ORDER BY
    CASE WHEN c.required_tier = 'community' THEN 0 ELSE 1 END,
    c.display_order NULLS LAST,
    c.id
  LIMIT 1
),
week_data (lesson_number, title, presentation_url) AS (
  VALUES
    (1, 'Welcome & Introductions', 'https://canva.link/rnvx27l4aru1tzt'),
    (2, 'Family Members', 'https://canva.link/ns78fug2y7dq99i'),
    (3, 'Numbers, Counting & Telling the Time', 'https://canva.link/u2sso5aqyl3of0y'),
    (4, 'Days of the Week & Dates', 'https://canva.link/cp4zmnne75en26l'),
    (5, 'Everyday Actions (Common Verbs)', 'https://canva.link/i9ls5pr8ob3dq8c6'),
    (6, 'Around the House', 'https://canva.link/l80jci8i7ucb6jz7'),
    (7, 'Things You Can Do (Ability)', 'https://canva.link/10dgzhungr38nd48'),
    (8, 'Feelings & Emotions', 'https://canva.link/69um7g4syj700q8'),
    (9, 'Animals', 'https://canva.link/wqd18wlomz3gfxv'),
    (10, 'Shopping & Money', 'https://canva.link/09a84mby5vghcnv'),
    (11, 'Food & Recipes', 'https://canva.link/fcrwvoinaytyq4'),
    (12, 'Positions & Directions', 'https://canva.link/7atekpybc07gq6l'),
    (13, 'Describing People (Adjectives)', 'https://canva.link/a9qjdleq71xbprz'),
    (14, 'Getting Around (Transport)', 'https://canva.link/a9gdgtquvo9eom9'),
    (15, 'Celebrations & Festivals', 'https://canva.link/n7q91iaay5u18tx'),
    (16, 'Talking About Yesterday (Past Tense)', 'https://canva.link/2eyzuwqqw42g9mc'),
    (17, 'Weather & Seasons', 'https://canva.link/nq3kx6se9lsynkk'),
    (18, 'Plans & Dreams (Future Tense)', 'https://canva.link/c1xk9giz92irn60'),
    (19, 'Health & Body', 'https://canva.link/oslfy8mehjvdw1x'),
    (20, 'Giving Directions', 'https://canva.link/ql16x7ycyxrwt2'),
    (21, 'At a Wedding / Cultural Events', 'https://canva.link/esq3guna400ulp8'),
    (22, 'Punjabi Music & Pop Culture', 'https://canva.link/cx6gnownwdvq4ii'),
    (23, 'Talking with Grandparents & Elders', 'https://canva.link/qvqctdq8nr77570'),
    (24, 'At the Gurdwara & Community Spaces', 'https://canva.link/aw8octp6cthgh3l')
)
UPDATE public.lessons AS l
SET
  title = w.title,
  presentation_url = w.presentation_url,
  is_free = true
FROM community_course AS cc,
     week_data AS w
WHERE l.course_id = cc.id
  AND l.lesson_number = w.lesson_number;

WITH community_course AS (
  SELECT c.id
  FROM public.courses AS c
  WHERE c.required_tier = 'community'
     OR c.name ILIKE '%community%'
  ORDER BY
    CASE WHEN c.required_tier = 'community' THEN 0 ELSE 1 END,
    c.display_order NULLS LAST,
    c.id
  LIMIT 1
),
week_data (lesson_number, title, presentation_url) AS (
  VALUES
    (1, 'Welcome & Introductions', 'https://canva.link/rnvx27l4aru1tzt'),
    (2, 'Family Members', 'https://canva.link/ns78fug2y7dq99i'),
    (3, 'Numbers, Counting & Telling the Time', 'https://canva.link/u2sso5aqyl3of0y'),
    (4, 'Days of the Week & Dates', 'https://canva.link/cp4zmnne75en26l'),
    (5, 'Everyday Actions (Common Verbs)', 'https://canva.link/i9ls5pr8ob3dq8c6'),
    (6, 'Around the House', 'https://canva.link/l80jci8i7ucb6jz7'),
    (7, 'Things You Can Do (Ability)', 'https://canva.link/10dgzhungr38nd48'),
    (8, 'Feelings & Emotions', 'https://canva.link/69um7g4syj700q8'),
    (9, 'Animals', 'https://canva.link/wqd18wlomz3gfxv'),
    (10, 'Shopping & Money', 'https://canva.link/09a84mby5vghcnv'),
    (11, 'Food & Recipes', 'https://canva.link/fcrwvoinaytyq4'),
    (12, 'Positions & Directions', 'https://canva.link/7atekpybc07gq6l'),
    (13, 'Describing People (Adjectives)', 'https://canva.link/a9qjdleq71xbprz'),
    (14, 'Getting Around (Transport)', 'https://canva.link/a9gdgtquvo9eom9'),
    (15, 'Celebrations & Festivals', 'https://canva.link/n7q91iaay5u18tx'),
    (16, 'Talking About Yesterday (Past Tense)', 'https://canva.link/2eyzuwqqw42g9mc'),
    (17, 'Weather & Seasons', 'https://canva.link/nq3kx6se9lsynkk'),
    (18, 'Plans & Dreams (Future Tense)', 'https://canva.link/c1xk9giz92irn60'),
    (19, 'Health & Body', 'https://canva.link/oslfy8mehjvdw1x'),
    (20, 'Giving Directions', 'https://canva.link/ql16x7ycyxrwt2'),
    (21, 'At a Wedding / Cultural Events', 'https://canva.link/esq3guna400ulp8'),
    (22, 'Punjabi Music & Pop Culture', 'https://canva.link/cx6gnownwdvq4ii'),
    (23, 'Talking with Grandparents & Elders', 'https://canva.link/qvqctdq8nr77570'),
    (24, 'At the Gurdwara & Community Spaces', 'https://canva.link/aw8octp6cthgh3l')
)
INSERT INTO public.lessons (course_id, lesson_number, title, presentation_url, is_free)
SELECT cc.id, w.lesson_number, w.title, w.presentation_url, true
FROM community_course AS cc
CROSS JOIN week_data AS w
WHERE NOT EXISTS (
  SELECT 1
  FROM public.lessons AS l
  WHERE l.course_id = cc.id
    AND l.lesson_number = w.lesson_number
);

-- Verify (optional — run separately):
-- SELECT l.lesson_number, l.title, l.presentation_url
-- FROM public.lessons l
-- JOIN public.courses c ON c.id = l.course_id
-- WHERE c.required_tier = 'community'
-- ORDER BY l.lesson_number;

NOTIFY pgrst, 'reload schema';
