-- Fix Picture Match vocab pairings (light vs lamp, tiger vs lion).
-- Safe to re-run.

-- "Light" meaning brightness → sun icon (not light bulb).
UPDATE public.flashcards
SET icon_name = 'sun'
WHERE category = 'vocab'
  AND lower(trim(split_part(front_text, '/', 1))) = 'light'
  AND back_text ~ '[\u0A00-\u0A7F]'
  AND (
    back_text ~ 'ਚਾਨਣ|ਰੋਸ਼ਨੀ|ਰੋਸ਼ਨ|ਉਜਾਲਾ'
    OR front_text ~* '(bright|brightness|sunshine|daylight)'
  );

-- Lamp / bulb → bulb icon.
UPDATE public.flashcards
SET icon_name = 'lamp'
WHERE category = 'vocab'
  AND back_text ~ '[\u0A00-\u0A7F]'
  AND (
    lower(trim(split_part(front_text, '/', 1))) IN ('lamp', 'bulb', 'light bulb')
    OR front_text ~* '(lamp|bulb|light bulb)'
    OR back_text ~ 'ਬੱਤੀ|ਦੀਵਾ'
  );

-- Bare "light" with no lamp Punjabi: treat as brightness (legacy rows).
UPDATE public.flashcards
SET icon_name = 'sun'
WHERE category = 'vocab'
  AND lower(trim(front_text)) = 'light'
  AND back_text ~ '[\u0A00-\u0A7F]'
  AND back_text !~ 'ਬੱਤੀ|ਦੀਵਾ'
  AND (icon_name IS NULL OR icon_name IN ('light', 'lamp', 'bulb'));

-- Tiger was sometimes paired with lion (ਸ਼ੇਰ).
UPDATE public.flashcards
SET
  back_text = 'ਬਾਘ',
  romanised = COALESCE(NULLIF(trim(romanised), ''), 'baagh')
WHERE category = 'vocab'
  AND lower(trim(split_part(front_text, '/', 1))) = 'tiger'
  AND back_text ~ 'ਸ਼ੇਰ'
  AND back_text !~ 'ਬਾਘ';

UPDATE public.flashcards
SET romanised = 'baagh'
WHERE category = 'vocab'
  AND lower(trim(split_part(front_text, '/', 1))) = 'tiger'
  AND back_text ~ 'ਬਾਘ'
  AND lower(trim(COALESCE(romanised, ''))) = 'sher';

UPDATE public.flashcards
SET icon_name = 'tiger'
WHERE category = 'vocab'
  AND lower(trim(split_part(front_text, '/', 1))) = 'tiger'
  AND (icon_name IS NULL OR icon_name = '');

NOTIFY pgrst, 'reload schema';
