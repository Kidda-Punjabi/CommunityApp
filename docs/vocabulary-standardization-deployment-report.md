# Vocabulary Standardization — Implementation Report

**Date**: 2026-08-06  
**PR**: [#6](https://github.com/Kidda-Punjabi/CommunityApp/pull/6) (DRAFT)  
**Branch**: `cursor/vocab-standardization-wait-stand-afa4`  
**Status**: ✅ Code changes complete, awaiting merge + SQL execution

---

## Changes Implemented

### ✅ "Wait" → `udeekna` (9 instances total)

| File | Line(s) | Change | Context |
|------|---------|--------|---------|
| `catchup-week7-seed.sql` | 199 | `intzaar kar` → `udeek` | Segment 5, translate question 9 (romanised) |
| `catchup-week7-seed.sql` | 233 | `intzaar kar` → `udeek` | Segment 7, translate question 8 (romanised) |
| `catchup-week8-seed.sql` | 211 | `intzaar kar` → `udeek` | Segment 7, narration beat (example) |
| `catchup-week8-seed.sql` | 228 | `intzaar kar` → `udeek` | Segment 8, translate question 4 (romanised) |
| `catchup-week8-seed.sql` | 353 | `intzaar kar` → `udeek` | Segment 15, homework question 8 (romanised) |
| `catchup-week9-seed.sql` | 177 | `intzaar kar` → `udeek` | Segment 7, translate question 4 (romanised) |
| `catchup-week9-seed.sql` | 257 | `intzaar karna` → `udeekna` | Segment 11, translate question 8 (romanised) |
| `catchup-week9-seed.sql` | 329 | `intzaar karna` → `udeekna` | Segment 15, homework question 14 (romanised) |

**Gurmukhi unchanged**: All instances were romanisation-only changes. Gurmukhi script for "wait" uses `ਉਡੀਕ` which was already present and correct.

### ✅ "Stand" → `kharo` (4 instances total)

| File | Line(s) | Change | Context |
|------|---------|--------|---------|
| `catchup-week10-seed.sql` | 57 | `'ਖੱਲੋ', 'khallo'` → `'ਖੜੋ', 'kharo'` | Master deck VALUES insert (Gurmukhi + romanised) |
| `catchup-week10-seed.sql` | 74 | `'khallo', 'khade ho'` → `'kharo', 'khade ho'` | Deduplication logic (romanised variants) |
| `catchup-week10-seed.sql` | 199 | `'Khallo'` → `'Kharo'` | Segment 6, translate question 2 (romanised) |

**Gurmukhi updated**: Changed from `ਖੱਲੋ` (incorrect) to `ਖੜੋ` (correct imperative of `kharna`).

### ✅ NOT Changed (Confirmed Correct)

- **`ruko`** (6 instances in Week 10): Unchanged — different verb (`rukna` = "to stop")
- **`udeek`** (1 instance in Week 2): Unchanged — already correct, matches canonical `udeekna`

---

## Gurupma Approval

All decisions confirmed via audit report (`docs/vocabulary-audit-wait-stand.md`):

1. ✅ **`intzaar` → `udeekna`**: Replace in all 9 instances. `udeekna` works as both infinitive and imperative in context — no separate conjugation needed.
2. ✅ **`khallo` → `kharo`**: Replace in all 4 instances. `kharo` is the confirmed imperative form of `kharna` (to stand).
3. ✅ **`ruko` unchanged**: Correction to audit — `ruko` is the imperative of `rukna` (to stop), NOT a variant of "wait". Leave all 6 instances as-is.

---

## Deployment Status

### ✅ Code Changes
- **Commit**: `4b3c75b`
- **Branch pushed**: `cursor/vocab-standardization-wait-stand-afa4`
- **PR created**: [#6](https://github.com/Kidda-Punjabi/CommunityApp/pull/6) (DRAFT)

### ⏳ Awaiting User Action

**To deploy these changes to production:**

1. **Merge PR #6** to `main`
2. **Run SQL scripts** in production Supabase:
   ```bash
   psql -f supabase/catchup-week7-seed.sql
   psql -f supabase/catchup-week8-seed.sql
   psql -f supabase/catchup-week9-seed.sql
   psql -f supabase/catchup-week10-seed.sql
   ```
3. **Verify live** (spot-check examples below)

---

## Verification Plan

After SQL scripts are run in production, spot-check these specific lessons in the live app:

### "Wait" (`udeekna`)
- **Week 7, Lesson 7, Segment 5** (Translate: Asking questions)
  - Question 9: Should show "Oh kiun **udeek** rahe han?" (Why are they waiting?)
  
- **Week 8, Lesson 8, Segment 8** (Translate: Past continuous)
  - Question 4: Should show "Oh bahar **udeek** rahe si" (They were waiting outside)

- **Week 9, Lesson 9, Segment 11** (Translate: Future ability & necessity)
  - Question 8: Should show "Sanu itthe **udeekna** pavega" (We will have to wait here)

### "Stand" (`kharo`)
- **Week 10, Lesson 10, Segment 6** (Translate: Imperatives)
  - Question 2: Should show "**Kharo**" (Stand up)
  - Gurmukhi should show `ਖੜੋ` (not `ਖੱਲੋ`)

- **Week 10, Lesson 10, Segment 5** (Flashcards: Common classroom imperatives)
  - Flashcard for "Stand.": Gurmukhi should show `ਖੜੋ`, romanised should show `kharo`

---

## Summary

**Total changes**: 13 instances across 4 SQL seed files  
**Files modified**: `catchup-week{7,8,9,10}-seed.sql`  
**Standardization complete**: ✅  
**Production deployment**: ⏳ Awaiting user merge + SQL execution  
**Live verification**: ⏳ Awaiting post-deployment spot-check

---

## Next Steps

1. User merges [PR #6](https://github.com/Kidda-Punjabi/CommunityApp/pull/6)
2. User runs SQL scripts in production Supabase
3. User performs spot-check verification in live app
4. User confirms completion or reports any issues
