# Everyday Punjabi

Self-serve topic mastery path in **Learn**. Track id: `"free"`. Product title: **Everyday Punjabi**.

Cursor agents also load `.cursor/rules/everyday-punjabi.mdc`.

---

## Where it sits in the app

| Surface | Path / relation |
|---------|-----------------|
| Bottom nav | **Learn** → `/dashboard/learn` |
| Entry card | First Learn hub card → `/dashboard/learn/free` |
| Topic path | Zigzag of topic nodes (`FreeLessonsPath`) |
| Topic hub | `/dashboard/learn/free/[lessonId]` |
| Practice | `/dashboard/learn/free/[lessonId]/practice` |
| Optional vocab | `/dashboard/learn/free/[lessonId]/vocab` |
| Optional sentences | `/dashboard/learn/free/[lessonId]/sentences` |

**Not the same as:**

- **Foundational / Beginners** — paid lesson lists, slides, homework (`LearnLessonList`)
- **Community (paid track)** — live/package weeks; track id `"community"`
- **Games** — `/dashboard/games` (shared patterns; separate scoring)
- **Kids Mode** — `/dashboard/kids`

Content for Everyday Punjabi topics still comes from **`COMMUNITY_COURSE_ID`** community flashcard weeks — that DB link is intentional; the **UI track** is still Everyday Punjabi / `"free"`.

---

## What it means / what it does

Learners work through **~24 everyday topics** in order. Each topic has **three stages**:

1. **Vocab** (words) — yellow ring  
2. **Sentences** (build phrases) — green ring  
3. **Speaking** (say it out loud) — purple ring  

Inside each stage there are **five practice depths** (Warm-up → Stage check). Passing raises depth; finishing depth 5 clears the stage and unlocks the next.

**Fully completed topic** = all three stages done → **purple shiny icon** (solid violet circle + shine sweep) on the path and hub. That signals mastery — not a crown badge.

**Progression gates:**

1. **Sequence** — topic N needs the previous topic’s Warm-up pass (`mastery_level >= 1`)
2. **Premium** — lessons with `is_free === false` need Premium; Premium does **not** skip sequence

Unlock CTA: `/dashboard/membership/premium`.

---

## Practice activities

Orchestrator: `TopicGamePractice` ← `resolveTopicGameActivity(stage, depth)`.

| Stage | Game kinds |
|-------|------------|
| Vocab | Match pairs; Speed quiz (English↔Punjabi, reverse at higher depths) |
| Sentences | Sentence tiles (distractors + romanisation; aligned with Games Sentence Builder) |
| Speaking | Speak it (STT); falls back to tiles if too few romanised phrases |

Supporting (optional, not the main mastery scorer):

- **Review Vocab** — browse/flip cards  
- **Sentence Building** — standalone tile builder under the hub  

Legacy MCQ session (`TopicPracticeSession` / `build-activity.ts`) is **not** the primary practice path.

---

## Current UX conventions (keep these)

1. **Romanisation** whenever Gurmukhi is shown (`PunjabiWithRomanisation`)  
2. **Multichoice confirm** — select option → **Check answer** → then Continue  
3. **Listen** — speaker (normal) + **Slow** (0.8×) on `TopicListenButton`  
4. **Tiles** — same interaction model as Games Sentence Builder; returning a tile restores its **`bankIndex`** slot so the bank order stays fixed  
5. **Speak** — retry after a miss; after **2** fails → Try again or **Skip**  
6. **Try again** on results — client remount only (`runKey`); does not roll back mastery  
7. **Hub** — no “X of Y words reviewed”; vocab is optional browse  
8. **Mastered badge** — purple + shine only when all three stages are complete; no crown count chip  

Speak STT may return Devanagari/Hindi script; matching latinises it. “Heard” feedback prefers Latin for learners who don’t read Gurmukhi.

---

Persist via **`topic_mastery`** only (`src/lib/free-lessons/mastery.ts`). Do not encode mastery into `lesson_progress` PDF fields (`last_page_viewed` / `total_pages` / `pdf_completed`) — those belong to Foundational/Beginners PDFs on the same Community lesson IDs.

Apply schema: `supabase/topic-mastery.sql`  
Backfill: `supabase/topic-mastery-backfill.sql` or `scripts/backfill-topic-mastery.ts`

---

## Key code map

```
src/app/dashboard/learn/free/          # routes + actions
src/components/learn/                  # path, hub, games, listen, romanisation
src/lib/free-lessons/                  # stages, mastery, unlock, activity-games, cards
src/lib/topics/constants.ts            # COMMUNITY_COURSE_ID
src/lib/learning/learn-catalog.ts      # Learn hub tracks
src/app/globals.css                    # .topic-mastery-* shine styles
```

Important components:

- `free-lessons-path.tsx`, `topic-hub-card.tsx`, `single-mastery-ring.tsx`
- `topic-game-practice.tsx` — results / Next / Try again
- `topic-match-activity.tsx`, `topic-speed-quiz-activity.tsx`, `topic-tiles-activity.tsx`, `topic-speak-activity.tsx`
- `topic-listen-button.tsx`, `punjabi-with-romanisation.tsx`

---

## Agent do-nots

- Don’t edit Foundational/Beginners slides when asked for Everyday Punjabi work  
- Don’t assume every topic is free — check `lesson.is_free` + Premium  
- Don’t reintroduce vocab review progress pressure on the hub  
- Don’t make Try again clear server mastery  
- When changing tile UX, keep Learn tiles aligned with Games Sentence Builder (`bankIndex` restore)  
