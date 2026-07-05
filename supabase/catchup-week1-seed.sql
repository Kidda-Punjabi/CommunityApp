-- =============================================================================
-- Kidda — Week 1 (Beginners) catch-up segments + beats seed
-- Run after supabase/catchup-lesson-segments.sql
-- Lesson: Beginner Phrases - Week 1 (lesson_number = 1)
-- =============================================================================

DO $$
DECLARE
  v_lesson_id UUID := '24ecdd3e-5f7d-472d-a9a4-415a7d32cd02';
  v_deck_id   UUID := 'fbd0d21f-6ddc-4a8f-8480-5ff97e426d61';

  -- Core phrase flashcards (full Q&A pair rows)
  v_fc_theek   UUID := 'e52227ad-365d-4587-b593-952df524168d';
  v_fc_naam    UUID := 'cc893969-34e5-461d-a7ec-47e0fa7b8e59';
  v_fc_punjabi UUID := 'd041baef-d73c-44ee-bd66-32d1e035cf41';
  v_fc_saal    UUID := '4ece0640-aaf1-434f-9079-eccc3a044cf4';
  v_fc_kithe   UUID := 'a1d78591-925c-4b79-87f7-bfd4e44892b3';
  v_fc_karde   UUID := 'aa9724a7-cb29-47dd-949e-9d6e9d2d480a';

  v_seg UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE id = v_lesson_id) THEN
    RAISE EXCEPTION 'Week 1 lesson not found — update v_lesson_id in this seed.';
  END IF;

  DELETE FROM public.lesson_segments WHERE lesson_id = v_lesson_id;

  -- Segment 1
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type)
  VALUES (v_lesson_id, 1, 1, 'Course intro & Week 1 goals', v_lesson_id::text || '/segment-01.jpg', 'none')
  RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Welcome to Week 1. This week we focus on getting familiar with Punjabi tone and rhythm, and learning six core conversational phrases you can use right away in real conversations.');

  -- Segment 2
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type)
  VALUES (v_lesson_id, 2, 2, 'Comfort Zone / Growth Zone', v_lesson_id::text || '/segment-02.jpg', 'none')
  RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Learning a language stretches you out of your comfort zone — and that is exactly where faster progress happens. Feeling a little uncomfortable when you speak is normal; it means you are growing.');

  -- Segment 3
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type)
  VALUES (v_lesson_id, 3, 3, 'Simple Introductions', v_lesson_id::text || '/segment-03.jpg', 'none')
  RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Let us start with simple introductions you can use in any Punjabi conversation.');
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, source_content_type, source_content_id) VALUES
    (v_seg, 2, 'phrase_reference', 'flashcard', v_fc_theek),
    (v_seg, 3, 'phrase_reference', 'flashcard', v_fc_naam);

  -- Segment 4
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type, activity_ref_id, activity_instructions)
  VALUES (v_lesson_id, 4, 4, 'Warming Up — the 6 core phrases', v_lesson_id::text || '/segment-04.jpg', 'flashcard_set', v_deck_id, 'Practise all six question-and-answer pairs in the flashcard set.')
  RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Let us warm up with six phrases you will hear all the time in Punjabi conversations.');
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, source_content_type, source_content_id) VALUES
    (v_seg, 2, 'phrase_reference', 'flashcard', v_fc_theek),
    (v_seg, 3, 'phrase_reference', 'flashcard', v_fc_naam),
    (v_seg, 4, 'phrase_reference', 'flashcard', v_fc_punjabi),
    (v_seg, 5, 'phrase_reference', 'flashcard', v_fc_saal),
    (v_seg, 6, 'phrase_reference', 'flashcard', v_fc_kithe),
    (v_seg, 7, 'phrase_reference', 'flashcard', v_fc_karde);
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 8, 'narration', 'Now try answering these yourself when they come up in the activity.');

  -- Segment 5
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type, activity_instructions)
  VALUES (v_lesson_id, 5, 5, 'Using Emotions', v_lesson_id::text || '/segment-05.jpg', 'none',
    'Record yourself saying one of the 6 phrases in an emotion of your choice (confused, angry, frustrated, happy, nervous, scared) and listen back.')
  RETURNING id INTO v_seg;

  -- Segment 6
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type, activity_ref_id, activity_instructions)
  VALUES (v_lesson_id, 6, 6, 'Memorising Phrases', v_lesson_id::text || '/segment-06.jpg', 'game', v_deck_id, 'Play Memory Grid with this week''s flashcard set to lock in the phrases.')
  RETURNING id INTO v_seg;

  -- Segment 7
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type)
  VALUES (v_lesson_id, 7, 7, 'Bonus: Conversational Phrases', v_lesson_id::text || '/segment-07.jpg', 'none')
  RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'Here are bonus conversational phrases — responses for feeling well or unwell, where you are from, what you do, and how to talk about today in the past and future.');

  -- Segment 8
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type, activity_ref_id, activity_instructions)
  VALUES (v_lesson_id, 8, 8, 'Conversational Cards', v_lesson_id::text || '/segment-08.jpg', 'game', NULL,
    'Pick one question and answer it aloud in Punjabi.')
  RETURNING id INTO v_seg;

  -- Segment 9
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type, activity_instructions)
  VALUES (v_lesson_id, 9, 9, 'Free Speaking Challenge', v_lesson_id::text || '/segment-09.jpg', 'none',
    'Try to speak Punjabi for as long as you can using the 6 core phrases as prompts. Record yourself.')
  RETURNING id INTO v_seg;

  -- Segment 10
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type)
  VALUES (v_lesson_id, 10, 10, 'Recap', v_lesson_id::text || '/segment-10.jpg', 'none')
  RETURNING id INTO v_seg;
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, script_text) VALUES
    (v_seg, 1, 'narration', 'You have now practised the six core phrases: how are you, what is your name, do you speak Punjabi, how old are you, where are you, and what do you do. You can use these to start and sustain real conversations.');
  INSERT INTO public.lesson_segment_beats (segment_id, beat_number, beat_type, source_content_type, source_content_id) VALUES
    (v_seg, 2, 'phrase_reference', 'flashcard', v_fc_theek),
    (v_seg, 3, 'phrase_reference', 'flashcard', v_fc_naam),
    (v_seg, 4, 'phrase_reference', 'flashcard', v_fc_punjabi),
    (v_seg, 5, 'phrase_reference', 'flashcard', v_fc_saal),
    (v_seg, 6, 'phrase_reference', 'flashcard', v_fc_kithe),
    (v_seg, 7, 'phrase_reference', 'flashcard', v_fc_karde);

  -- Segment 11
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type, activity_ref_id, activity_instructions)
  VALUES (v_lesson_id, 11, 11, 'Flashcards review', v_lesson_id::text || '/segment-11.jpg', 'flashcard_set', v_deck_id, 'Review all six core phrases one more time.')
  RETURNING id INTO v_seg;

  -- Segment 12 (quiz ref null until quiz exists for this lesson)
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type, activity_ref_id, activity_instructions)
  VALUES (v_lesson_id, 12, 12, 'Recap Quiz', v_lesson_id::text || '/segment-12.jpg', 'quiz', NULL, 'Complete the Week 1 recap quiz.')
  RETURNING id INTO v_seg;

  -- Segment 13
  INSERT INTO public.lesson_segments (lesson_id, segment_number, sort_order, title, teaching_image_path, activity_type, activity_ref_id, activity_instructions)
  VALUES (v_lesson_id, 13, 13, 'Homework', v_lesson_id::text || '/segment-13.jpg', 'homework', v_lesson_id,
    'Record a short voice note using this week''s phrases.')
  RETURNING id INTO v_seg;

  RAISE NOTICE 'Week 1 catch-up segments seeded for lesson %', v_lesson_id;
  RAISE NOTICE 'FLAG: phrase_reference beats need approved flashcard audio (content_type=flashcard) — none exist yet.';
  RAISE NOTICE 'FLAG: Segment 12 quiz activity_ref_id is NULL — create/link Week 1 quiz in admin.';
  RAISE NOTICE 'NEXT: run supabase/catchup-week1-visuals-seed.sql for teaching visuals.';
END $$;

NOTIFY pgrst, 'reload schema';
