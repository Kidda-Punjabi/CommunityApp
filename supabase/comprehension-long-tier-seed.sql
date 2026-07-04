-- =============================================================================
-- Kidda — Comprehension Practice seed (Long tier, all 7 scripts)
-- Run in Supabase SQL Editor AFTER:
--   comprehension-practice.sql
--   comprehension-paragraphs-tier.sql
--
-- Idempotent: deletes scripts by title, then re-inserts (L1–L7, display_order 27–33).
-- =============================================================================

DELETE FROM public.comprehension_scripts
WHERE title IN (
  'A letter to a grandparent about learning Punjabi',
  'A local cultural event (news-style)',
  'Keeping language and culture alive',
  'The wise farmer of the village',
  'At the vegetable shop',
  'Finding my identity',
  'How to make Punjabi chole'
);

DO $$
DECLARE
  script_id UUID;
  p1 UUID; p2 UUID; p3 UUID; p4 UUID;
BEGIN
  -- ===========================================================================
  -- L1: A letter to a grandparent about learning Punjabi
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A letter to a grandparent about learning Punjabi',
    'Draft — pending native speaker review. Personal letter genre. Access: paid.',
    'long', 6, 27, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO p1;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO p2;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 3) RETURNING id INTO p3;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, p1, 1, 'ਪਿਆਰੇ ਨਾਨਾ ਜੀ, ਸਤ ਸ੍ਰੀ ਅਕਾਲ।', 'Piyaare Naana ji, Sat Sri Akaal.', 'Dear Grandfather, Sat Sri Akaal.'),
    (script_id, p1, 2, 'ਮੈਨੂੰ ਉਮੀਦ ਹੈ ਕਿ ਤੁਸੀਂ ਠੀਕ ਹੋਵੋਗੇ।', 'Mainu umeed hai ki tusi theek hovoge.', 'I hope you are well.'),
    (script_id, p1, 3, 'ਮੈਂ ਤੁਹਾਨੂੰ ਇੱਕ ਖ਼ਾਸ ਗੱਲ ਦੱਸਣ ਲਈ ਲਿਖ ਰਿਹਾ ਹਾਂ।', 'Mai tuhaanu ik khaas gall dassan lai likh rihaa haa.', 'I''m writing to tell you something special.'),
    (script_id, p1, 4, 'ਪਿਛਲੇ ਕੁਝ ਮਹੀਨਿਆਂ ਤੋਂ ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਿਹਾ ਹਾਂ।', 'Pichhle kujh mahiniaa toh mai Punjabi sikh rihaa haa.', 'For the past few months I''ve been learning Punjabi.'),
    (script_id, p2, 1, 'ਮੈਨੂੰ ਹਮੇਸ਼ਾ ਬੁਰਾ ਲੱਗਦਾ ਸੀ ਕਿ ਮੈਂ ਤੁਹਾਡੇ ਨਾਲ ਆਪਣੀ ਮਾਂ ਬੋਲੀ ਵਿੱਚ ਗੱਲ ਨਹੀਂ ਕਰ ਸਕਦਾ ਸੀ।', 'Mainu hamesha buraa laggda si ki mai tuhaade naal apni maa boli vich gall nahi kar sakda si.', 'I always used to feel bad that I couldn''t talk with you in our mother tongue.'),
    (script_id, p2, 2, 'ਇਸ ਲਈ ਮੈਂ ਕਿੱਡਾ ਨਾਲ ਪੰਜਾਬੀ ਸਿੱਖਣੀ ਸ਼ੁਰੂ ਕੀਤੀ ਹੈ।', 'Is lai mai Kidda naal Punjabi sikhni shuru kiti hai.', 'So I''ve started learning Punjabi with Kidda.'),
    (script_id, p2, 3, 'ਹਰ ਹਫ਼ਤੇ ਮੈਂ ਨਵੇਂ ਸ਼ਬਦ ਅਤੇ ਵਾਕ ਸਿੱਖਦਾ ਹਾਂ।', 'Har hafte mai nave shabad ate vaak sikhda haa.', 'Every week I learn new words and sentences.'),
    (script_id, p2, 4, 'ਹੁਣ ਮੈਂ ਸਧਾਰਨ ਗੱਲਾਂ ਪੰਜਾਬੀ ਵਿੱਚ ਸਮਝ ਸਕਦਾ ਹਾਂ।', 'Hun mai sadhaaran gallaa Punjabi vich samajh sakda haa.', 'Now I can understand simple things in Punjabi.'),
    (script_id, p3, 1, 'ਅਗਲੀ ਵਾਰ ਜਦੋਂ ਮੈਂ ਤੁਹਾਨੂੰ ਮਿਲਾਂਗਾ, ਮੈਂ ਪੰਜਾਬੀ ਵਿੱਚ ਗੱਲ ਕਰਨ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰਾਂਗਾ।', 'Agli vaar jadoh mai tuhaanu milaanga, mai Punjabi vich gall karan di koshish karaanga.', 'Next time I see you, I''ll try to speak in Punjabi.'),
    (script_id, p3, 2, 'ਮੈਨੂੰ ਪਤਾ ਹੈ ਕਿ ਤੁਸੀਂ ਬਹੁਤ ਖੁਸ਼ ਹੋਵੋਗੇ।', 'Mainu pataa hai ki tusi bahut khush hovoge.', 'I know you''ll be very happy.'),
    (script_id, p3, 3, 'ਆਪਣਾ ਖ਼ਿਆਲ ਰੱਖਣਾ।', 'Apna khiaal rakkhna.', 'Take care of yourself.'),
    (script_id, p3, 4, 'ਤੁਹਾਡਾ ਪੋਤਾ।', 'Tuhaadaa potaa.', 'Your grandson.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਲਿਖਣ ਵਾਲਾ ਕੀ ਸਿੱਖ ਰਿਹਾ ਹੈ? (Likhan vaalaa ki sikh rihaa hai?)', 'ਹਿੰਦੀ (Hindi)', 'ਪੰਜਾਬੀ (Punjabi)', 'ਉਰਦੂ (Urdu)', 'ਅੰਗਰੇਜ਼ੀ (Angrezi)', 'b', 0),
    (script_id, 'ਪਹਿਲਾਂ ਉਸਨੂੰ ਕੀ ਬੁਰਾ ਲੱਗਦਾ ਸੀ? (Pehlaa usnu ki buraa laggda si?)', 'ਗੱਲ ਨਹੀਂ ਕਰ ਸਕਦਾ ਸੀ (gall nahi kar sakda si)', 'ਖਾਣਾ ਨਹੀਂ ਬਣਾ ਸਕਦਾ ਸੀ (khana nahi banaa sakda si)', 'ਗਾਣੇ ਨਹੀਂ ਸੁਣ ਸਕਦਾ ਸੀ (gaane nahi sun sakda si)', 'ਕਿਤਾਬਾਂ ਨਹੀਂ ਪੜ੍ਹ ਸਕਦਾ ਸੀ (kitaabaa nahi parh sakda si)', 'a', 1),
    (script_id, 'ਉਹ ਕਿੱਥੋਂ ਸਿੱਖ ਰਿਹਾ ਹੈ? (Oh kitthoh sikh rihaa hai?)', 'ਸਕੂਲ (school)', 'ਕਿੱਡਾ (Kidda)', 'ਯੂਨੀਵਰਸਿਟੀ (university)', 'ਔਨਲਾਈਨ ਵੀਡੀਓ (online video)', 'b', 2),
    (script_id, 'ਹੁਣ ਉਹ ਕੀ ਸਮਝ ਸਕਦਾ ਹੈ? (Hun oh ki samajh sakda hai?)', 'ਸਧਾਰਨ ਗੱਲਾਂ (sadhaaran gallaa)', 'ਗੁੰਝਲਦਾਰ ਕਿਤਾਬਾਂ (gunjhaldaar kitaabaa)', 'ਖ਼ਬਰਾਂ (khabraa)', 'ਗਣਿਤ (ganit)', 'a', 3),
    (script_id, 'ਅਗਲੀ ਵਾਰ ਮਿਲਣ ''ਤੇ ਉਹ ਕੀ ਕਰੇਗਾ? (Agli vaar milan te oh ki karega?)', 'ਅੰਗਰੇਜ਼ੀ ਬੋਲੇਗਾ (angrezi bolega)', 'ਪੰਜਾਬੀ ਬੋਲਣ ਦੀ ਕੋਸ਼ਿਸ਼ ਕਰੇਗਾ (Punjabi bolan di koshish karega)', 'ਚੁੱਪ ਰਹੇਗਾ (chup rahega)', 'ਸਿਰਫ਼ ਲਿਖ ਕੇ ਦੇਵੇਗਾ (sirf likh ke devega)', 'b', 4);

  -- ===========================================================================
  -- L2: A local cultural event (news-style)
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'A local cultural event (news-style)',
    'Draft — pending native speaker review. News report genre. Access: paid.',
    'long', 6, 28, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO p1;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO p2;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 3) RETURNING id INTO p3;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, p1, 1, 'ਇਸ ਹਫ਼ਤੇ ਸ਼ਹਿਰ ਦੇ ਗੁਰਦੁਆਰੇ ਵਿੱਚ ਇੱਕ ਵੱਡਾ ਸੱਭਿਆਚਾਰਕ ਮੇਲਾ ਲਾਇਆ ਗਿਆ ਸੀ।', 'Is hafte shehar de gurduare vich ik vaddaa sabhiaachaarak melaa laaiya gya si.', 'This week a big cultural fair was held at the city''s gurdwara.'),
    (script_id, p1, 2, 'ਸੈਂਕੜੇ ਲੋਕ ਇਸ ਮੇਲੇ ਵਿੱਚ ਪਹੁੰਚੇ ਸੀ।', 'Saikde lok is mele vich pahunche si.', 'Hundreds of people had come to this fair.'),
    (script_id, p1, 3, 'ਮੇਲੇ ਵਿੱਚ ਭੰਗੜਾ, ਗਿੱਧਾ ਅਤੇ ਲੋਕ ਗੀਤਾਂ ਦੇ ਪ੍ਰੋਗਰਾਮ ਹੋਏ ਸੀ।', 'Mele vich bhangra, giddha ate lok geetaa de program hoe si.', 'The fair had bhangra, giddha, and folk-song performances.'),
    (script_id, p1, 4, 'ਬੱਚਿਆਂ ਲਈ ਵੱਖਰੇ ਸਟਾਲ ਲਗਾਏ ਗਏ ਸੀ।', 'Bacchiaa lai vakhre stall lagaae gae si.', 'Separate stalls had been set up for children.'),
    (script_id, p2, 1, 'ਸਥਾਨਕ ਕਲਾਕਾਰਾਂ ਨੇ ਪਰੰਪਰਾਗਤ ਪੰਜਾਬੀ ਕੱਪੜੇ ਪਾ ਕੇ ਪ੍ਰਦਰਸ਼ਨ ਕੀਤਾ ਸੀ।', 'Sathaanak kalaakaaraa ne parparaagat Punjabi kapre pa ke pradarshan kita si.', 'Local artists had performed wearing traditional Punjabi clothes.'),
    (script_id, p2, 2, 'ਮੇਲੇ ਵਿੱਚ ਪੰਜਾਬੀ ਖਾਣੇ ਦੇ ਸਟਾਲ ਵੀ ਲਗਾਏ ਗਏ ਸੀ।', 'Mele vich Punjabi khaane de stall vi lagaae gae si.', 'Punjabi food stalls had also been set up at the fair.'),
    (script_id, p2, 3, 'ਲੋਕਾਂ ਨੇ ਛੋਲੇ ਭਟੂਰੇ, ਲੱਸੀ ਅਤੇ ਮਿੱਠੇ ਪਕਵਾਨਾਂ ਦਾ ਆਨੰਦ ਲਿਆ ਸੀ।', 'Lokaa ne chhole bhatoore, lassi ate mitthe pakvaanaa da anand liya si.', 'People had enjoyed chole bhature, lassi, and sweet dishes.'),
    (script_id, p2, 4, 'ਸ਼ਹਿਰ ਦੇ ਮੇਅਰ ਨੇ ਵੀ ਇਸ ਸਮਾਗਮ ਵਿੱਚ ਸ਼ਿਰਕਤ ਕੀਤੀ ਸੀ।', 'Shehar de mayor ne vi is samaagam vich shirkat kiti si.', 'The city''s mayor had also attended this event.'),
    (script_id, p3, 1, 'ਮੇਅਰ ਨੇ ਆਪਣੇ ਭਾਸ਼ਣ ਵਿੱਚ ਪੰਜਾਬੀ ਭਾਈਚਾਰੇ ਦੀ ਸ਼ਲਾਘਾ ਕੀਤੀ ਸੀ।', 'Mayor ne apne bhaashan vich Punjabi bhaichaare di shlaaghaa kiti si.', 'The mayor had praised the Punjabi community in his speech.'),
    (script_id, p3, 2, 'ਪ੍ਰਬੰਧਕਾਂ ਨੇ ਦੱਸਿਆ ਕਿ ਅਗਲੇ ਸਾਲ ਇਹ ਮੇਲਾ ਹੋਰ ਵੀ ਵੱਡੇ ਪੱਧਰ ''ਤੇ ਕਰਵਾਇਆ ਜਾਵੇਗਾ।', 'Prabandhkaa ne dassiya ki agle saal ih melaa hor vi vadde padhar te karvaiya jaavega.', 'Organizers said next year this fair will be held on an even bigger scale.'),
    (script_id, p3, 3, 'ਇਹ ਸਮਾਗਮ ਦੇਰ ਰਾਤ ਤੱਕ ਚੱਲਿਆ ਸੀ।', 'Ih samaagam der raat takk chaliya si.', 'This event had run until late at night.'),
    (script_id, p3, 4, 'ਸਾਰੇ ਲੋਕ ਖੁਸ਼ ਅਤੇ ਸੰਤੁਸ਼ਟ ਹੋ ਕੇ ਘਰ ਪਰਤੇ ਸੀ।', 'Saare lok khush ate santusht ho ke ghar parte si.', 'All the people had returned home happy and satisfied.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਮੇਲਾ ਕਿੱਥੇ ਲਾਇਆ ਗਿਆ? (Melaa kitthe laaiya gya?)', 'ਸਕੂਲ ਵਿੱਚ (school vich)', 'ਗੁਰਦੁਆਰੇ ਵਿੱਚ (gurduare vich)', 'ਪਾਰਕ ਵਿੱਚ (park vich)', 'ਹਸਪਤਾਲ ਵਿੱਚ (hspatal vich)', 'b', 0),
    (script_id, 'ਮੇਲੇ ਵਿੱਚ ਕੀ ਪ੍ਰੋਗਰਾਮ ਹੋਏ? (Mele vich ki program hoe?)', 'ਭੰਗੜਾ ਅਤੇ ਗਿੱਧਾ (bhangra ate giddha)', 'ਕ੍ਰਿਕਟ ਮੈਚ (cricket match)', 'ਫ਼ਿਲਮ (film)', 'ਕੀਰਤਨ (keertan)', 'a', 1),
    (script_id, 'ਕੌਣ ਸਮਾਗਮ ਵਿੱਚ ਆਇਆ? (Kaun samaagam vich aaiya?)', 'ਪ੍ਰਧਾਨ ਮੰਤਰੀ (Prime Minister)', 'ਮੇਅਰ (Mayor)', 'ਪੁਲਿਸ (Police)', 'ਅਧਿਆਪਕ (adhiapak)', 'b', 2),
    (script_id, 'ਲੋਕਾਂ ਨੇ ਕੀ ਖਾਧਾ? (Lokaa ne ki khadha?)', 'ਪੀਜ਼ਾ (pizza)', 'ਛੋਲੇ ਭਟੂਰੇ (chhole bhatoore)', 'ਬਰਗਰ (burger)', 'ਦਾਲ (daal)', 'b', 3),
    (script_id, 'ਅਗਲੇ ਸਾਲ ਮੇਲਾ ਕਿਵੇਂ ਹੋਵੇਗਾ? (Agle saal melaa kiven hovega?)', 'ਛੋਟਾ (chota)', 'ਵੱਡੇ ਪੱਧਰ ''ਤੇ (vadde padhar te)', 'ਬੰਦ (band)', 'ਉਹੀ ਜਿਹਾ (ohi jiha)', 'b', 4);

  -- ===========================================================================
  -- L3: Keeping language and culture alive
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Keeping language and culture alive',
    'Draft — pending native speaker review. Opinion piece genre. Access: paid.',
    'long', 7, 29, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO p1;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO p2;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 3) RETURNING id INTO p3;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, p1, 1, 'ਅੱਜ ਦੇ ਸਮੇਂ ਵਿੱਚ ਬਹੁਤ ਸਾਰੇ ਨੌਜਵਾਨ ਆਪਣੀ ਮਾਂ ਬੋਲੀ ਭੁੱਲਦੇ ਜਾ ਰਹੇ ਹਨ।', 'Ajj de samen vich bahut saare naujavaan apni maa boli bhulde ja rahe han.', 'Nowadays many young people are forgetting their mother tongue.'),
    (script_id, p1, 2, 'ਮੇਰੇ ਖ਼ਿਆਲ ਵਿੱਚ ਇਹ ਇੱਕ ਗੰਭੀਰ ਸਮੱਸਿਆ ਹੈ।', 'Mere khiaal vich ih ik gambhir samasyaa hai.', 'In my opinion this is a serious problem.'),
    (script_id, p1, 3, 'ਭਾਸ਼ਾ ਸਿਰਫ਼ ਬੋਲਣ ਦਾ ਸਾਧਨ ਨਹੀਂ, ਸਗੋਂ ਸਾਡੀ ਪਛਾਣ ਦਾ ਹਿੱਸਾ ਹੈ।', 'Bhaashaa sirf bolan da saadhan nahi, sagoh saadi pachhaan da hissaa hai.', 'Language isn''t just a tool for speaking, but a part of our identity.'),
    (script_id, p1, 4, 'ਜੇ ਅਸੀਂ ਆਪਣੀ ਭਾਸ਼ਾ ਭੁੱਲ ਜਾਈਏ, ਅਸੀਂ ਆਪਣੇ ਸੱਭਿਆਚਾਰ ਨਾਲੋਂ ਵੀ ਟੁੱਟ ਜਾਂਦੇ ਹਾਂ।', 'Je asi apni bhaashaa bhul jaaiye, asi apne sabhiaachaar naaloh vi tutt jaande haa.', 'If we forget our language, we also break away from our culture.'),
    (script_id, p2, 1, 'ਮੈਂ ਮੰਨਦਾ ਹਾਂ ਕਿ ਹਰ ਮਾਪੇ ਨੂੰ ਆਪਣੇ ਬੱਚਿਆਂ ਨਾਲ ਪੰਜਾਬੀ ਵਿੱਚ ਗੱਲ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ।', 'Mai mannda haa ki har maape nu apne bacchiaa naal Punjabi vich gall karnee chahidi hai.', 'I believe every parent should speak with their children in Punjabi.'),
    (script_id, p2, 2, 'ਬੱਚੇ ਘਰ ਵਿੱਚ ਸੁਣ ਕੇ ਹੀ ਭਾਸ਼ਾ ਸਿੱਖਦੇ ਹਨ।', 'Bacche ghar vich sun ke hi bhaashaa sikhde han.', 'Children learn language just by hearing it at home.'),
    (script_id, p2, 3, 'ਸਕੂਲ ਅਤੇ ਭਾਈਚਾਰੇ ਦੇ ਪ੍ਰੋਗਰਾਮ ਵੀ ਬਹੁਤ ਮਦਦਗਾਰ ਹੋ ਸਕਦੇ ਹਨ।', 'School ate bhaichaare de program vi bahut madadgaar ho sakde han.', 'School and community programs can also be very helpful.'),
    (script_id, p2, 4, 'ਸਾਨੂੰ ਪੰਜਾਬੀ ਗਾਣੇ, ਫ਼ਿਲਮਾਂ ਅਤੇ ਕਿਤਾਬਾਂ ਨੂੰ ਵੀ ਉਤਸ਼ਾਹਿਤ ਕਰਨਾ ਚਾਹੀਦਾ ਹੈ।', 'Saanu Punjabi gaane, filmaa ate kitaabaa nu vi utshaahit karnaa chahida hai.', 'We should also encourage Punjabi songs, films, and books.'),
    (script_id, p3, 1, 'ਮੈਂ ਖ਼ੁਦ ਪੰਜਾਬੀ ਸਿੱਖ ਕੇ ਇਹ ਮਹਿਸੂਸ ਕੀਤਾ ਹੈ ਕਿ ਭਾਸ਼ਾ ਮੈਨੂੰ ਮੇਰੇ ਪਰਿਵਾਰ ਦੇ ਨੇੜੇ ਲਿਆਈ ਹੈ।', 'Mai khud Punjabi sikh ke ih mehsoos kita hai ki bhaashaa mainu mere parivar de nede liyaai hai.', 'By learning Punjabi myself, I''ve felt that language has brought me closer to my family.'),
    (script_id, p3, 2, 'ਇਹ ਸਿਰਫ਼ ਸ਼ਬਦਾਂ ਦੀ ਗੱਲ ਨਹੀਂ, ਇਹ ਰਿਸ਼ਤਿਆਂ ਦੀ ਗੱਲ ਹੈ।', 'Ih sirf shabdaa di gall nahi, ih rishtiaa di gall hai.', 'This isn''t just about words — it''s about relationships.'),
    (script_id, p3, 3, 'ਜੇ ਅਸੀਂ ਹੁਣ ਕੋਸ਼ਿਸ਼ ਨਹੀਂ ਕਰਾਂਗੇ, ਆਉਣ ਵਾਲੀ ਪੀੜ੍ਹੀ ਸਾਡੀ ਭਾਸ਼ਾ ਪੂਰੀ ਤਰ੍ਹਾਂ ਗੁਆ ਦੇਵੇਗੀ।', 'Je asi hun koshish nahi karaange, aaunn vaali peedhi saadi bhaashaa poori tarhaa guaa devegi.', 'If we don''t try now, the next generation will lose our language completely.'),
    (script_id, p3, 4, 'ਇਸ ਲਈ, ਆਓ ਅਸੀਂ ਸਾਰੇ ਮਿਲ ਕੇ ਆਪਣੀ ਭਾਸ਼ਾ ਅਤੇ ਸੱਭਿਆਚਾਰ ਨੂੰ ਜ਼ਿੰਦਾ ਰੱਖੀਏ।', 'Is lai, aao asi saare mil ke apni bhaashaa ate sabhiaachaar nu zindaa rakkhiye.', 'So let''s all come together and keep our language and culture alive.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਲੇਖਕ ਅਨੁਸਾਰ ਕੀ ਸਮੱਸਿਆ ਹੈ? (Lekhak anusaar ki samasyaa hai?)', 'ਨੌਜਵਾਨ ਭਾਸ਼ਾ ਭੁੱਲ ਰਹੇ ਹਨ (naujavaan bhaashaa bhul rahe han)', 'ਬਜ਼ੁਰਗ ਬਿਮਾਰ ਹਨ (bazurag bimaar han)', 'ਸਕੂਲ ਬੰਦ ਹੋ ਰਹੇ ਹਨ (school band ho rahe han)', 'ਪੈਸੇ ਘੱਟ ਹਨ (paise ghatt han)', 'a', 0),
    (script_id, 'ਲੇਖਕ ਅਨੁਸਾਰ ਭਾਸ਼ਾ ਕੀ ਹੈ? (Lekhak anusaar bhaashaa ki hai?)', 'ਸਿਰਫ਼ ਸਾਧਨ (sirf saadhan)', 'ਪਛਾਣ ਦਾ ਹਿੱਸਾ (pachhaan da hissaa)', 'ਬੇਕਾਰ ਚੀਜ਼ (bekaar cheez)', 'ਸਿਰਫ਼ ਲਿਖਣ ਲਈ (sirf likhan lai)', 'b', 1),
    (script_id, 'ਲੇਖਕ ਕਿਸਨੂੰ ਪੰਜਾਬੀ ਬੋਲਣ ਲਈ ਕਹਿੰਦਾ ਹੈ? (Lekhak kisnu Punjabi bolan lai kehnda hai?)', 'ਸਿਰਫ਼ ਅਧਿਆਪਕ (sirf adhiapak)', 'ਹਰ ਮਾਪੇ (har maape)', 'ਸਿਰਫ਼ ਬੱਚੇ (sirf bacche)', 'ਸਿਰਫ਼ ਦਾਦਾ-ਦਾਦੀ (sirf dada-daadi)', 'b', 2),
    (script_id, 'ਲੇਖਕ ਨੂੰ ਭਾਸ਼ਾ ਸਿੱਖ ਕੇ ਕੀ ਮਹਿਸੂਸ ਹੋਇਆ? (Lekhak nu bhaashaa sikh ke ki mehsoos hoiya?)', 'ਪਰਿਵਾਰ ਦੇ ਨੇੜੇ ਆਇਆ (parivar de nede aaiya)', 'ਹੋਰ ਦੂਰ ਹੋਇਆ (hor door hoiya)', 'ਕੋਈ ਫ਼ਰਕ ਨਹੀਂ ਪਿਆ (koi farak nahi piya)', 'ਗੁਸਸਾ hoiya (gussa hoiya)', 'a', 3),
    (script_id, 'ਲੇਖਕ ਦਾ ਸੁਨੇਹਾ ਕੀ ਹੈ? (Lekhak da sunehaa ki hai?)', 'ਭਾਸ਼ਾ ਭੁੱਲ ਜਾਓ (bhaashaa bhul jaao)', 'ਭਾਸ਼ਾ ਅਤੇ ਸੱਭਿਆਚਾਰ ਜ਼ਿੰਦਾ ਰੱਖੀਏ (bhaashaa ate sabhiaachaar zindaa rakkhiye)', 'ਸਿਰਫ਼ ਅੰਗਰੇਜ਼ੀ ਬੋਲੋ (sirf angrezi bolo)', 'ਕਿਤਾਬਾਂ ਨਾ ਪੜ੍ਹੋ (kitaabaa na parho)', 'b', 4);

  -- ===========================================================================
  -- L4: The wise farmer of the village
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'The wise farmer of the village',
    'Draft — pending native speaker review. Folk tale genre. Access: paid.',
    'long', 6, 30, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO p1;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO p2;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 3) RETURNING id INTO p3;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, p1, 1, 'ਬਹੁਤ ਸਮਾਂ ਪਹਿਲਾਂ ਪੰਜਾਬ ਦੇ ਇੱਕ ਪਿੰਡ ਵਿੱਚ ਇੱਕ ਗ਼ਰੀਬ ਪਰ ਸਿਆਣਾ ਕਿਸਾਨ ਰਹਿੰਦਾ ਸੀ।', 'Bahut samaa pehlaa Punjab de ik pind vich ik gareeb par siaanaa kisaan rehnda si.', 'Long ago in a village in Punjab, a poor but wise farmer lived.'),
    (script_id, p1, 2, 'ਉਸਦਾ ਨਾਂ ਬੂਟਾ ਸਿੰਘ ਸੀ।', 'Usda naa Boota Singh si.', 'His name was Boota Singh.'),
    (script_id, p1, 3, 'ਉਸ ਕੋਲ ਸਿਰਫ਼ ਥੋੜ੍ਹੀ ਜਿਹੀ ਜ਼ਮੀਨ ਸੀ।', 'Us kol sirf thodi jihi zameen si.', 'He only had a small piece of land.'),
    (script_id, p1, 4, 'ਪਰ ਉਹ ਹਮੇਸ਼ਾ ਮਿਹਨਤ ਨਾਲ ਕੰਮ ਕਰਦਾ ਸੀ।', 'Par oh hamesha mehnat naal kaam karda si.', 'But he always worked hard.'),
    (script_id, p2, 1, 'ਇੱਕ ਸਾਲ ਬਹੁਤ ਭਿਆਨਕ ਸੋਕਾ ਪਿਆ ਸੀ।', 'Ik saal bahut bhiaanak sokaa piya si.', 'One year there was a terrible drought.'),
    (script_id, p2, 2, 'ਪਿੰਡ ਦੀਆਂ ਸਾਰੀਆਂ ਫ਼ਸਲਾਂ ਸੁੱਕ ਗਈਆਂ ਸੀ।', 'Pind diaa saariaa faslaa sukk gaiaa si.', 'All the village''s crops had dried up.'),
    (script_id, p2, 3, 'ਲੋਕ ਬਹੁਤ ਪਰੇਸ਼ਾਨ ਹੋ ਗਏ ਸੀ।', 'Lok bahut pareshaan ho gae si.', 'The people had become very worried.'),
    (script_id, p2, 4, 'ਬੂਟਾ ਸਿੰਘ ਨੇ ਸਾਰੇ ਪਿੰਡ ਨੂੰ ਇਕੱਠਾ ਕਰਕੇ ਇੱਕ ਖੂਹ ਪੁੱਟਣ ਦਾ ਸੁਝਾਅ ਦਿੱਤਾ ਸੀ।', 'Boota Singh ne saare pind nu ikattha karke ik khooh puttan da sujhaa dittaa si.', 'Boota Singh had gathered the whole village and suggested digging a well.'),
    (script_id, p3, 1, 'ਸਾਰੇ ਪਿੰਡ ਵਾਲਿਆਂ ਨੇ ਮਿਲ ਕੇ ਦਿਨ-ਰਾਤ ਮਿਹਨਤ ਕੀਤੀ ਸੀ।', 'Saare pind vaaliaa ne mil ke din-raat mehnat kiti si.', 'All the villagers had worked hard together, day and night.'),
    (script_id, p3, 2, 'ਕੁਝ ਹਫ਼ਤਿਆਂ ਬਾਅਦ ਖੂਹ ਵਿੱਚੋਂ ਪਾਣੀ ਨਿਕਲ ਆਇਆ ਸੀ।', 'Kujh haftiaa baad khooh vichoh paani nikal aaiya si.', 'After a few weeks, water had come out from the well.'),
    (script_id, p3, 3, 'ਪੂਰੇ ਪਿੰਡ ਨੇ ਖ਼ੁਸ਼ੀ ਮਨਾਈ ਸੀ।', 'Poore pind ne khushi manaai si.', 'The whole village had celebrated with joy.'),
    (script_id, p3, 4, 'ਉਸ ਦਿਨ ਤੋਂ ਲੋਕ ਬੂਟਾ ਸਿੰਘ ਨੂੰ ਪਿੰਡ ਦਾ ਸਿਆਣਾ ਬਜ਼ੁਰਗ ਮੰਨਣ ਲੱਗ ਪਏ ਸੀ।', 'Us din toh lok Boota Singh nu pind da siaanaa bazurag mannan lagg pae si.', 'From that day, people began seeing Boota Singh as the village''s wise elder.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਕਿਸਾਨ ਦਾ ਨਾਂ ਕੀ ਸੀ? (Kisaan da naa ki si?)', 'ਮੋਹਨ ਸਿੰਘ (Mohan Singh)', 'ਬੂਟਾ ਸਿੰਘ (Boota Singh)', 'ਜੀਤ ਸਿੰਘ (Jeet Singh)', 'ਗੁਰਦੀਪ ਸਿੰਘ (Gurdeep Singh)', 'b', 0),
    (script_id, 'ਪਿੰਡ ਵਿੱਚ ਕੀ ਸਮੱਸਿਆ ਆਈ? (Pind vich ki samasyaa aai?)', 'ਹੜ੍ਹ (harh)', 'ਸੋਕਾ (sokaa)', 'ਅੱਗ (agg)', 'ਬਰਫ਼ (barf)', 'b', 1),
    (script_id, 'ਬੂਟਾ ਸਿੰਘ ਨੇ ਕੀ ਸੁਝਾਅ ਦਿੱਤਾ? (Boota Singh ne ki sujhaa dittaa?)', 'ਪਿੰਡ ਛੱਡਣ ਦਾ (pind chhadan da)', 'ਖੂਹ ਪੁੱਟਣ ਦਾ (khooh puttan da)', 'ਦੁਆ ਕਰਨ ਦਾ (duaa karan da)', 'ਨਵੀਂ ਫ਼ਸਲ ਬੀਜਣ ਦਾ (navee fasl beejdan da)', 'b', 2),
    (script_id, 'ਖੂਹ ਵਿੱਚੋਂ ਕੀ ਨਿਕਲਿਆ? (Khooh vichoh ki nikaliya?)', 'ਸੋਨਾ (sonaa)', 'ਪਾਣੀ (paani)', 'ਤੇਲ (tel)', 'ਗੈਸ (gas)', 'b', 3),
    (script_id, 'ਲੋਕ ਬੂਟਾ ਸਿੰਘ ਨੂੰ ਕੀ ਮੰਨਣ ਲੱਗੇ? (Lok Boota Singh nu ki mannan lagge?)', 'ਪਿੰਡ ਦਾ ਸਰਪੰਚ (pind da sarpanch)', 'ਪਿੰਡ ਦਾ ਸਿਆਣਾ ਬਜ਼ੁਰਗ (pind da siaanaa bazurag)', 'ਪਿੰਡ ਦਾ ਅਧਿਆਪਕ (pind da adhiapak)', 'ਪਿੰਡ ਦਾ ਡਾਕਟਰ (pind da daaktar)', 'b', 4);

  -- ===========================================================================
  -- L5: At the vegetable shop
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'At the vegetable shop',
    'Draft — pending native speaker review. Dialogue transcript genre. Access: paid.',
    'long', 5, 31, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO p1;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO p2;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 3) RETURNING id INTO p3;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, p1, 1, 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ! ਤੁਹਾਨੂੰ ਕੀ ਚਾਹੀਦਾ ਹੈ?', 'Sat Sri Akaal ji! Tuhaanu ki chahida hai?', '(Shopkeeper) Hello! What do you need?'),
    (script_id, p1, 2, 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਮੈਨੂੰ ਕੁਝ ਸਬਜ਼ੀਆਂ ਚਾਹੀਦੀਆਂ ਹਨ।', 'Sat Sri Akaal. Mainu kujh sabziaa chahidiaa han.', '(Customer) Hello. I need some vegetables.'),
    (script_id, p1, 3, 'ਅੱਜ ਸਾਡੇ ਕੋਲ ਤਾਜ਼ੇ ਆਲੂ ਅਤੇ ਟਮਾਟਰ ਹਨ।', 'Ajj saade kol taaze aaloo ate tamaatar han.', '(Shopkeeper) Today we have fresh potatoes and tomatoes.'),
    (script_id, p1, 4, 'ਬਹੁਤ ਵਧੀਆ, ਮੈਨੂੰ ਦੋ ਕਿੱਲੋ ਆਲੂ ਦੇ ਦਿਓ।', 'Bahut vadhia, mainu do kilo aaloo de dio.', '(Customer) Very good — give me two kilos of potatoes.'),
    (script_id, p2, 1, 'ਹੋਰ ਕੁਝ ਚਾਹੀਦਾ ਹੈ?', 'Hor kujh chahida hai?', '(Shopkeeper) Do you need anything else?'),
    (script_id, p2, 2, 'ਹਾਂ, ਇੱਕ ਕਿੱਲੋ ਟਮਾਟਰ ਵੀ ਦੇ ਦਿਓ।', 'Haa, ik kilo tamaatar vi de dio.', '(Customer) Yes, give me one kilo of tomatoes too.'),
    (script_id, p2, 3, 'ਕੁੱਲ ਮਿਲਾ ਕੇ ਸੌ ਰੁਪਏ ਹੋਏ ਹਨ।', 'Kull milaa ke sau rupae hoe han.', '(Shopkeeper) All together it''s one hundred rupees.'),
    (script_id, p2, 4, 'ਇਹ ਲਓ, ਧੰਨਵਾਦ।', 'Ih lao, dhanvaad.', '(Customer) Here you go, thank you.'),
    (script_id, p3, 1, 'ਧੰਨਵਾਦ ਜੀ, ਫਿਰ ਆਉਣਾ।', 'Dhanvaad ji, phir aaunaa.', '(Shopkeeper) Thank you, come again.'),
    (script_id, p3, 2, 'ਜ਼ਰੂਰ ਆਵਾਂਗਾ। ਰੱਬ ਰਾਖਾ।', 'Zaroor aavaanga. Rabb raakhaa.', '(Customer) I will. Goodbye.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਗਾਹਕ ਨੇ ਕੀ ਮੰਗਿਆ? (Gaahak ne ki mangiya?)', 'ਫਲ (phal)', 'ਸਬਜ਼ੀਆਂ (sabziaa)', 'ਕੱਪੜੇ (kapre)', 'ਦੁੱਧ (dudh)', 'b', 0),
    (script_id, 'ਦੁਕਾਨਦਾਰ ਕੋਲ ਅੱਜ ਕੀ ਤਾਜ਼ਾ ਸੀ? (Dukaandaar kol ajj ki taazaa si?)', 'ਆਲੂ ਅਤੇ ਟਮਾਟਰ (aaloo ate tamaatar)', 'ਪਿਆਜ਼ (piaaz)', 'ਗਾਜਰ (gaajar)', 'ਮਿਰਚ (mirch)', 'a', 1),
    (script_id, 'ਗਾਹਕ ਨੇ ਕਿੰਨੇ ਕਿੱਲੋ ਆਲੂ ਲਏ? (Gaahak ne kinne kilo aaloo lae?)', 'ਇੱਕ (ik)', 'ਦੋ (do)', 'ਤਿੰਨ (tinn)', 'ਅੱਧਾ (adhaa)', 'b', 2),
    (script_id, 'ਕੁੱਲ ਕਿੰਨੇ ਪੈਸੇ ਹੋਏ? (Kull kinne paise hoe?)', 'ਪੰਜਾਹ (panjaah)', 'ਸੌ (sau)', 'ਦੋ ਸੌ (do sau)', 'ਅੱਠ ਸੌ (ath sau)', 'b', 3);

  -- ===========================================================================
  -- L6: Finding my identity
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'Finding my identity',
    'Draft — pending native speaker review. Diary/reflective entry genre. Access: paid.',
    'long', 7, 32, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO p1;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO p2;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 3) RETURNING id INTO p3;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 4) RETURNING id INTO p4;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, p1, 1, 'ਅੱਜ ਮੈਂ ਬਹੁਤ ਦੇਰ ਤੱਕ ਆਪਣੀ ਦਾਦੀ ਜੀ ਦੀਆਂ ਪੁਰਾਣੀਆਂ ਫੋਟੋਆਂ ਦੇਖਦਾ ਰਿਹਾ।', 'Ajj mai bahut der takk apni daadi ji diaa puraaniaa photoaa dekhda rihaa.', 'Today I kept looking at my grandmother''s old photos for a long time.'),
    (script_id, p1, 2, 'ਉਹ ਫੋਟੋਆਂ ਮੈਨੂੰ ਇੱਕ ਵੱਖਰੀ ਦੁਨੀਆ ਵਿੱਚ ਲੈ ਗਈਆਂ।', 'Oh photoaa mainu ik vakhri duniaa vich lai gaiaa.', 'Those photos took me to a different world.'),
    (script_id, p1, 3, 'ਮੈਂ ਸੋਚਦਾ ਰਿਹਾ ਕਿ ਮੈਂ ਆਪਣੀਆਂ ਜੜ੍ਹਾਂ ਬਾਰੇ ਕਿੰਨਾ ਘੱਟ ਜਾਣਦਾ ਹਾਂ।', 'Mai sochda rihaa ki mai apniaa jarhaa baare kinna ghatt jaanda haa.', 'I kept thinking about how little I know about my roots.'),
    (script_id, p2, 1, 'ਮੈਂ ਵਿਦੇਸ਼ ਵਿੱਚ ਵੱਡਾ ਹੋਇਆ ਹਾਂ ਅਤੇ ਪੰਜਾਬੀ ਬੋਲਣ ਦਾ ਮੌਕਾ ਘੱਟ ਹੀ ਮਿਲਿਆ।', 'Mai videsh vich vaddaa hoiya haa ate Punjabi bolan da mauka ghatt hi miliya.', 'I grew up abroad and rarely got the chance to speak Punjabi.'),
    (script_id, p2, 2, 'ਕਈ ਵਾਰ ਮੈਨੂੰ ਲੱਗਦਾ ਹੈ ਕਿ ਮੈਂ ਦੋ ਸੰਸਾਰਾਂ ਦੇ ਵਿਚਕਾਰ ਹਾਂ।', 'Kai vaar mainu laggda hai ki mai do sansaaraa de vichkaar haa.', 'Sometimes I feel that I''m between two worlds.'),
    (script_id, p2, 3, 'ਇੱਕ ਪਾਸੇ ਮੇਰੀ ਅੰਗਰੇਜ਼ੀ ਜ਼ਿੰਦਗੀ ਹੈ ਅਤੇ ਦੂਜੇ ਪਾਸੇ ਮੇਰੀ ਪੰਜਾਬੀ ਵਿਰਾਸਤ।', 'Ik paase meri angrezi zindagi hai ate dooje paase meri Punjabi viraasat.', 'On one side is my English life, and on the other my Punjabi heritage.'),
    (script_id, p3, 1, 'ਪਰ ਜਦੋਂ ਤੋਂ ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖਣੀ ਸ਼ੁਰੂ ਕੀਤੀ ਹੈ, ਇਹ ਦੂਰੀ ਘੱਟ ਹੋਣ ਲੱਗੀ ਹੈ।', 'Par jadoh toh mai Punjabi sikhni shuru kiti hai, ih doori ghatt hon laggi hai.', 'But since I started learning Punjabi, this distance has started to lessen.'),
    (script_id, p3, 2, 'ਹਰ ਨਵਾਂ ਸ਼ਬਦ ਮੈਨੂੰ ਆਪਣੇ ਪਰਿਵਾਰ ਦੇ ਨੇੜੇ ਲੈ ਜਾਂਦਾ ਹੈ।', 'Har navaa shabad mainu apne parivar de nede lai jaanda hai.', 'Every new word brings me closer to my family.'),
    (script_id, p3, 3, 'ਮੈਨੂੰ ਲੱਗਦਾ ਹੈ ਕਿ ਮੈਂ ਹੌਲੀ-ਹੌਲੀ ਆਪਣੀ ਪਛਾਣ ਨੂੰ ਲੱਭ ਰਿਹਾ ਹਾਂ।', 'Mainu laggda hai ki mai hauli-hauli apni pachhaan nu labh rihaa haa.', 'I feel that I''m slowly finding my identity.'),
    (script_id, p4, 1, 'ਅੱਜ ਰਾਤ ਮੈਂ ਆਪਣੀ ਦਾਦੀ ਜੀ ਨੂੰ ਫ਼ੋਨ ਕਰਾਂਗਾ।', 'Ajj raat mai apni daadi ji nu phone karaanga.', 'Tonight I''ll call my grandmother.'),
    (script_id, p4, 2, 'ਮੈਂ ਉਹਨਾਂ ਨੂੰ ਪੰਜਾਬੀ ਵਿੱਚ "ਮੈਂ ਤੁਹਾਨੂੰ ਪਿਆਰ ਕਰਦਾ ਹਾਂ" ਕਹਿਣਾ ਚਾਹੁੰਦਾ ਹਾਂ।', 'Mai ohnaa nu Punjabi vich "mai tuhaanu piyaar karda haa" kehnaa chahunda haa.', 'I want to tell her "I love you" in Punjabi.'),
    (script_id, p4, 3, 'ਇਹ ਛੋਟਾ ਜਿਹਾ ਵਾਕ ਮੇਰੇ ਲਈ ਬਹੁਤ ਵੱਡਾ ਅਰਥ ਰੱਖਦਾ ਹੈ।', 'Ih chota jihaa vaak mere lai bahut vaddaa arth rakkhda hai.', 'This small sentence holds a very big meaning for me.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਲਿਖਣ ਵਾਲਾ ਅੱਜ ਕੀ ਦੇਖ ਰਿਹਾ ਸੀ? (Likhan vaalaa ajj ki dekh rihaa si?)', 'ਵੀਡੀਓ (video)', 'ਪੁਰਾਣੀਆਂ ਫੋਟੋਆਂ (puraaniaa photoaa)', 'ਕਿਤਾਬਾਂ (kitaabaa)', 'ਫ਼ਿਲਮ (film)', 'b', 0),
    (script_id, 'ਉਹ ਕਿੱਥੇ ਵੱਡਾ ਹੋਇਆ? (Oh kitthe vaddaa hoiya?)', 'ਪੰਜਾਬ ਵਿੱਚ (Punjab vich)', 'ਵਿਦੇਸ਼ ਵਿੱਚ (videsh vich)', 'ਦਿੱਲੀ ਵਿੱਚ (Delhi vich)', 'ਮੁੰਬਈ ਵਿੱਚ (Mumbai vich)', 'b', 1),
    (script_id, 'ਪੰਜਾਬੀ ਸਿੱਖਣ ਨਾਲ ਕੀ ਹੋਇਆ? (Punjabi sikhan naal ki hoiya?)', 'ਦੂਰੀ ਵਧੀ (doori vadhi)', 'ਦੂਰੀ ਘਟੀ (doori ghatti)', 'ਕੋਈ ਫ਼ਰਕ ਨਹੀਂ ਪਿਆ (koi farak nahi piya)', 'ਘੱਟ ਸਮਾਂ ਮਿਲਿਆ (ghatt samaa miliya)', 'b', 2),
    (script_id, 'ਅੱਜ ਰਾਤ ਉਹ ਕੀ ਕਰੇਗਾ? (Ajj raat oh ki karega?)', 'ਸੌਂ ਜਾਏਗਾ (saun jaaega)', 'ਦਾਦੀ ਜੀ ਨੂੰ ਫ਼ੋਨ ਕਰੇਗਾ (daadi ji nu phone karega)', 'ਪੜ੍ਹੇਗਾ (parhega)', 'ਖਾਣਾ ਬਣਾਏਗਾ (khana banaaega)', 'b', 3);

  -- ===========================================================================
  -- L7: How to make Punjabi chole
  -- ===========================================================================
  INSERT INTO public.comprehension_scripts (
    title, description, tier, difficulty, display_order, active, needs_rewrite
  ) VALUES (
    'How to make Punjabi chole',
    'Draft — pending native speaker review. Instructional/recipe genre. Access: paid.',
    'long', 5, 33, true, false
  ) RETURNING id INTO script_id;

  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 1) RETURNING id INTO p1;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 2) RETURNING id INTO p2;
  INSERT INTO public.comprehension_paragraphs (script_id, sequence_order) VALUES (script_id, 3) RETURNING id INTO p3;

  INSERT INTO public.comprehension_sentences (script_id, paragraph_id, sequence_order, gurmukhi_text, romanised_text, english_translation) VALUES
    (script_id, p1, 1, 'ਅੱਜ ਅਸੀਂ ਪੰਜਾਬੀ ਛੋਲੇ ਬਣਾਉਣਾ ਸਿੱਖਾਂਗੇ।', 'Ajj asi Punjabi chhole banaunaa sikhaange.', 'Today we''ll learn to make Punjabi chole (chickpeas).'),
    (script_id, p1, 2, 'ਇਸ ਲਈ ਸਾਨੂੰ ਛੋਲੇ, ਪਿਆਜ਼, ਟਮਾਟਰ ਅਤੇ ਮਸਾਲੇ ਚਾਹੀਦੇ ਹਨ।', 'Is lai saanu chhole, piaaz, tamaatar ate masaale chahide han.', 'For this we need chickpeas, onion, tomato, and spices.'),
    (script_id, p1, 3, 'ਪਹਿਲਾਂ ਛੋਲਿਆਂ ਨੂੰ ਰਾਤ ਭਰ ਪਾਣੀ ਵਿੱਚ ਭਿਓਂ ਕੇ ਰੱਖੋ।', 'Pehlaa choliaa nu raat bhar paani vich bhioh ke rakkho.', 'First soak the chickpeas in water overnight.'),
    (script_id, p2, 1, 'ਸਵੇਰੇ ਛੋਲਿਆਂ ਨੂੰ ਕੂਕਰ ਵਿੱਚ ਉਬਾਲੋ।', 'Savere choliaa nu cooker vich ubaalo.', 'In the morning boil the chickpeas in a cooker.'),
    (script_id, p2, 2, 'ਦੂਜੇ ਪਾਸੇ, ਪਿਆਜ਼ ਅਤੇ ਟਮਾਟਰ ਨੂੰ ਬਾਰੀਕ ਕੱਟੋ।', 'Dooje paase, piaaz ate tamaatar nu baareek katto.', 'On the other side, finely chop the onion and tomato.'),
    (script_id, p2, 3, 'ਤੇਲ ਵਿੱਚ ਪਿਆਜ਼ ਨੂੰ ਸੁਨਹਿਰੀ ਹੋਣ ਤੱਕ ਭੁੰਨੋ।', 'Tel vich piaaz nu sunehri hon takk bhunno.', 'Fry the onion in oil until golden.'),
    (script_id, p2, 4, 'ਫਿਰ ਟਮਾਟਰ ਅਤੇ ਮਸਾਲੇ ਪਾ ਕੇ ਚੰਗੀ ਤਰ੍ਹਾਂ ਭੁੰਨੋ।', 'Phir tamaatar ate masaale pa ke changgi tarhaa bhunno.', 'Then add tomato and spices and fry well.'),
    (script_id, p3, 1, 'ਉਬਲੇ ਹੋਏ ਛੋਲੇ ਇਸ ਮਸਾਲੇ ਵਿੱਚ ਪਾ ਦਿਓ।', 'Uble hoe chhole is masaale vich pa dio.', 'Add the boiled chickpeas to this spice mixture.'),
    (script_id, p3, 2, 'ਦਸ ਮਿੰਟ ਲਈ ਹੌਲੀ ਅੱਗ ''ਤੇ ਪਕਾਓ।', 'Das minute lai hauli agg te pakaao.', 'Cook on low heat for ten minutes.'),
    (script_id, p3, 3, 'ਉੱਪਰੋਂ ਥੋੜ੍ਹਾ ਧਨੀਆ ਪਾ ਦਿਓ।', 'Uproh thoda dhania pa dio.', 'Add a little coriander on top.'),
    (script_id, p3, 4, 'ਗਰਮ ਛੋਲੇ ਭਟੂਰੇ ਜਾਂ ਚੌਲਾਂ ਨਾਲ ਪਰੋਸੋ।', 'Garam chhole bhatoore jaan chaulaa naal paroso.', 'Serve the hot chole with bhature or rice.'),
    (script_id, p3, 5, 'ਇਹ ਪਕਵਾਨ ਹਰ ਪੰਜਾਬੀ ਘਰ ਵਿੱਚ ਬਹੁਤ ਪਸੰਦ ਕੀਤਾ ਜਾਂਦਾ ਹੈ।', 'Ih pakvaan har Punjabi ghar vich bahut pasand kita jaanda hai.', 'This dish is loved in every Punjabi home.');

  INSERT INTO public.comprehension_questions (script_id, question_text, option_a, option_b, option_c, option_d, correct_option, sequence_order) VALUES
    (script_id, 'ਛੋਲਿਆਂ ਨੂੰ ਰਾਤ ਭਰ ਕਿੱਥੇ ਭਿਓਣਾ ਹੈ? (Choliaa nu raat bhar kitthe bhionaa hai?)', 'ਦੁੱਧ ਵਿੱਚ (dudh vich)', 'ਪਾਣੀ ਵਿੱਚ (paani vich)', 'ਤੇਲ ਵਿੱਚ (tel vich)', 'ਦਹੀਂ ਵਿੱਚ (dahi vich)', 'b', 0),
    (script_id, 'ਪਿਆਜ਼ ਨੂੰ ਕਿਵੇਂ ਭੁੰਨਣਾ ਹੈ? (Piaaz nu kiven bhunnaa hai?)', 'ਸੁਨਹਿਰੀ ਹੋਣ ਤੱਕ (sunehri hon takk)', 'ਕਾਲਾ ਹੋਣ ਤੱਕ (kaalaa hon takk)', 'ਨਰਮ ਹੋਣ ਤੱਕ (naram hon takk)', 'ਕੱਚਾ ਰੱਖਣਾ (kachaa rakkhna)', 'a', 1),
    (script_id, 'ਛੋਲੇ ਕਿੰਨੇ ਮਿੰਟ ਪਕਾਉਣੇ ਹਨ? (Chhole kinne minute pakaaunne han?)', 'ਪੰਜ (panj)', 'ਦਸ (das)', 'ਵੀਹ (veeh)', 'ਤੀਹ (teeh)', 'b', 2),
    (script_id, 'ਛੋਲੇ ਕਿਸ ਨਾਲ ਪਰੋਸਣੇ ਹਨ? (Chhole kis naal parosne han?)', 'ਸਲਾਦ ਨਾਲ (salad naal)', 'ਭਟੂਰੇ ਜਾਂ ਚੌਲਾਂ ਨਾਲ (bhatoore jaan chaulaa naal)', 'ਦਹੀਂ ਨਾਲ (dahi naal)', 'ਰੋਟੀ ਨਾਲ (roti naal)', 'b', 3);

END $$;

NOTIFY pgrst, 'reload schema';
