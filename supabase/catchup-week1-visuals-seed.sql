-- =============================================================================
-- Kidda — Week 1 catch-up teaching visuals seed
-- Run after supabase/catchup-teaching-visuals.sql and catchup-week1-seed.sql
-- =============================================================================

DO $$
DECLARE
  v_lesson_id UUID := '24ecdd3e-5f7d-472d-a9a4-415a7d32cd02';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.lessons WHERE id = v_lesson_id) THEN
    RAISE EXCEPTION 'Week 1 lesson not found.';
  END IF;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'icon_hero',
    teaching_visual_config = '{"icons":["Sparkles"],"label":"Week 1: Getting started","accentColor":"purple"}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 1;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'zone_diagram',
    teaching_visual_config = '{"zones":[{"icon":"Sofa","label":"Comfort zone","sublabel":"Not speaking Punjabi","color":"gray"},{"icon":"TrendingUp","label":"Stretch zone","sublabel":"Learning phrases alone","color":"amber"},{"icon":"Rocket","label":"Growth zone","sublabel":"Speaking with new people","color":"green"}]}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 2;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'phrase_showcase',
    teaching_visual_config = '{"items":[{"icon":"Hand","label":"Hello"},{"icon":"User","label":"My name is..."},{"icon":"MapPin","label":"I''m from..."}]}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 3;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'phrase_showcase',
    teaching_visual_config = '{"items":[{"icon":"Smile","label":"Are you okay?"},{"icon":"User","label":"What''s your name?"},{"icon":"Languages","label":"Do you speak Punjabi?"},{"icon":"Calendar","label":"How old are you?"},{"icon":"Home","label":"Where are you?"},{"icon":"Briefcase","label":"What do you do?"}]}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 4;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'activity_scene',
    teaching_visual_config = '{"icons":["Smile","Frown","Angry","Meh"],"caption":"Say a phrase in an emotion"}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 5;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'activity_scene',
    teaching_visual_config = '{"icons":["Brain"],"caption":"Test your memory"}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 6;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'phrase_showcase',
    teaching_visual_config = '{"items":[{"icon":"MessageCircle","label":"How are you?"},{"icon":"MapPin","label":"Where are you from?"},{"icon":"Briefcase","label":"What do you do?"},{"icon":"Clock","label":"What did you do today?"}]}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 7;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'activity_scene',
    teaching_visual_config = '{"icons":["Shuffle"],"caption":"Pick a card and answer"}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 8;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'activity_scene',
    teaching_visual_config = '{"icons":["Mic"],"caption":"Speak as long as you can"}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 9;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'recap_banner',
    teaching_visual_config = '{"icon":"CheckCircle2","heading":"You can now...","subheading":"Introduce yourself in Punjabi"}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 10;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'icon_hero',
    teaching_visual_config = '{"icons":["Layers"],"label":"Flashcards","accentColor":"teal"}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 11;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'quiz_banner',
    teaching_visual_config = '{"icon":"ClipboardCheck","heading":"Quick recap quiz"}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 12;

  UPDATE public.lesson_segments SET
    teaching_visual_type = 'icon_hero',
    teaching_visual_config = '{"icons":["Mic","Home"],"label":"Homework: record a voice note","accentColor":"coral"}'::jsonb
  WHERE lesson_id = v_lesson_id AND segment_number = 13;

  RAISE NOTICE 'Week 1 teaching visuals seeded for lesson %', v_lesson_id;
END $$;
