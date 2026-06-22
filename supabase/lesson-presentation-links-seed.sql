-- =============================================================================
-- Kidda — Seed presentation URLs (Foundational weeks 1–4, Beginners lessons 1–12)
-- Run AFTER supabase/lesson-presentations.sql and supabase/lesson-completion.sql
-- Matches lessons by course required_tier + lesson_number.
-- =============================================================================

ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS presentation_url TEXT;

-- Foundational Course — weeks 1–4
UPDATE public.lessons AS l
SET presentation_url = v.url
FROM public.courses AS c,
     (
       VALUES
         (
           1,
           'https://www.canva.com/design/DAHAwr3uuUk/zbZlFpldCEA7ObGUgUaRuQ/edit?utm_content=DAHAwr3uuUk&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton'
         ),
         (
           2,
           'https://www.canva.com/design/DAHAwr6_oJU/1gPvkCwSBFtqrUKSWPiM6w/edit?utm_content=DAHAwr6_oJU&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton'
         ),
         (
           3,
           'https://www.canva.com/design/DAG34f6ksig/tkFMUl2cskVBs87cXh3BlA/edit?utm_content=DAG34f6ksig&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton'
         ),
         (4, 'https://canva.link/nqo9s0awd0ho3ms')
     ) AS v(lesson_number, url)
WHERE l.course_id = c.id
  AND c.required_tier = 'foundational'
  AND l.lesson_number = v.lesson_number;

-- Beginners Course — lessons 1–12
UPDATE public.lessons AS l
SET presentation_url = v.url
FROM public.courses AS c,
     (
       VALUES
         (
           1,
           'https://www.canva.com/design/DAHDiJWsATM/Nb6tuRyKiclEwiiA8Yqhdw/view?utm_content=DAHDiJWsATM&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hf5594c4f07'
         ),
         (
           2,
           'https://www.canva.com/design/DAHDiKjcDEg/OYD7j73pSbOmtBKA_MCuow/view?utm_content=DAHDiKjcDEg&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h82917c3481'
         ),
         (
           3,
           'https://www.canva.com/design/DAHDiImBPio/O5acBo5WFu6XRJipGb-iMg/view?utm_content=DAHDiImBPio&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=hb63a66fd2c'
         ),
         (
           4,
           'https://www.canva.com/design/DAHDiE-ZG7I/ffuHvRu8Yp-mcIbI_91wew/view?utm_content=DAHDiE-ZG7I&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=he9764fa615'
         ),
         (
           5,
           'https://www.canva.com/design/DAHDiJwX7M0/82kolt-xkUq5ZOqub09d3A/view?utm_content=DAHDiJwX7M0&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h8be3d4e713'
         ),
         (
           6,
           'https://www.canva.com/design/DAHDiLyjG-k/7a5sZ26qRBf57LEzMsx1Zg/view?utm_content=DAHDiLyjG-k&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h8fd23d7aa0'
         ),
         (
           7,
           'https://www.canva.com/design/DAHDiCRj-2U/1eq3d6VhugtlpLmKQIw3WQ/view?utm_content=DAHDiCRj-2U&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h14d05023a4'
         ),
         (
           8,
           'https://www.canva.com/design/DAHDiDhngg4/3DcbeBkYEPbR22RvrndmKA/view?utm_content=DAHDiDhngg4&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h0b962ba01b'
         ),
         (
           9,
           'https://www.canva.com/design/DAHDiPzaheU/J7v07W9o1EI4mjXVb6lPVQ/view?utm_content=DAHDiPzaheU&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h04a1752db2'
         ),
         (
           10,
           'https://www.canva.com/design/DAHDiB_iek8/YW3G4Aphcbb0TXK0efH4vQ/view?utm_content=DAHDiB_iek8&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h5d17a6cc3b'
         ),
         (
           11,
           'https://www.canva.com/design/DAHDiA7FSVk/IO55-c9Vg-vkiaBHBC67kA/view?utm_content=DAHDiA7FSVk&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h44ea1f2a32'
         ),
         (
           12,
           'https://www.canva.com/design/DAHDiKrLUlM/5nU8-FYXJY4sUsLG5XF1Xw/view?utm_content=DAHDiKrLUlM&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&utlId=h9caa2246e3'
         )
     ) AS v(lesson_number, url)
WHERE l.course_id = c.id
  AND c.required_tier = 'beginners'
  AND l.lesson_number = v.lesson_number;

-- Optional: verify how many rows were updated (run separately if you like)
-- SELECT c.name, l.lesson_number, l.title, l.presentation_url IS NOT NULL AS has_link
-- FROM public.lessons l
-- JOIN public.courses c ON c.id = l.course_id
-- WHERE c.required_tier IN ('foundational', 'beginners')
-- ORDER BY c.required_tier, l.lesson_number;

NOTIFY pgrst, 'reload schema';
