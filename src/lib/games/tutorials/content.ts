import { COMPREHENSION_PRACTICE_DISPLAY_NAME } from "@/lib/comprehension/config";
import { CONVERSATION_PRACTICE_DISPLAY_NAME } from "@/lib/conversation/config";
import { CHADO_PAURI_DISPLAY_NAME } from "@/lib/games/chado-pauri/config";
import { LANE_RUNNER_DISPLAY_NAME } from "@/lib/games/lane-runner/config";
import { KIHDA_DISPLAY_NAME } from "@/lib/possessive-practice/config";
import { SPOT_THE_MISTAKE_DISPLAY_NAME } from "@/lib/spot-the-mistake/config";
import type { GameTutorialContent, TutorialId } from "./types";

const TUTORIALS: Record<TutorialId, GameTutorialContent> = {
  match: {
    id: "match",
    title: "How to play Match",
    steps: [
      "You'll see Punjabi words and English meanings shuffled into a grid.",
      "Tap one tile, then tap its match. Correct pairs clear; wrong picks flash briefly.",
      "You have 60 seconds — match as many pairs as you can before time runs out.",
    ],
  },
  memory_grid: {
    id: "memory_grid",
    title: "How to play Memory Grid",
    steps: [
      "Cards start face-down. Flip two at a time to find Punjabi ↔ English pairs.",
      "Remember where cards were — mismatched flips turn back over.",
      "Clear the whole grid to finish. Fewer flips and faster clears score better.",
    ],
  },
  speed_translate: {
    id: "speed_translate",
    title: "How to play Translation Sprint",
    steps: [
      "Read the prompt, then pick the correct translation from the options.",
      "You have limited lives — wrong answers cost a life.",
      "Faster correct answers earn more points. Keep going until lives run out or the round ends.",
    ],
  },
  picture_match: {
    id: "picture_match",
    title: "How to play Picture Match",
    steps: [
      "You'll see a picture (and English) — pick the matching Punjabi word.",
      "Optional: tap the speaker on the picture to hear the word (turn word audio off on the start screen if you prefer).",
      "After you answer, tap Next when you're ready — nothing auto-advances.",
    ],
  },
  streak_survival: {
    id: "streak_survival",
    title: "How to play Streak Survival",
    steps: [
      "Answer multiple-choice questions one after another.",
      "Every correct answer grows your streak. One wrong answer ends the run.",
      "Beat your personal best by surviving as long as you can.",
    ],
  },
  sentence_builder: {
    id: "sentence_builder",
    title: "How to play Sentence Builder",
    steps: [
      "Read the English prompt, then tap Punjabi word tiles in the right order.",
      "Tiles move from the bank into your sentence — tap a built tile to send it back.",
      "Check your answer when ready. Wrong builds show the correct sentence before you continue.",
    ],
  },
  conjugation_challenge: {
    id: "conjugation_challenge",
    title: "How to play Conjugation Challenge",
    steps: [
      "Each question asks for the correct verb form for a tense and subject.",
      "Pick one of the multiple-choice options (Gurmukhi + romanisation).",
      "Choose how many questions and which tenses on the start screen, then work through the round.",
    ],
  },
  gender_sort: {
    id: "gender_sort",
    title: "How to play Gender Sort",
    steps: [
      "You'll see a Punjabi noun (with romanisation and English).",
      "Sort it as masculine or feminine — tap a side, or swipe if that feels faster.",
      "Some rounds also practise adjective agreement — pick the form that matches the noun.",
    ],
  },
  voice_practice: {
    id: "voice_practice",
    title: "How to play Speak It",
    steps: [
      "You'll get an English prompt and a Punjabi target sentence to say aloud.",
      "Tap record, speak clearly, then stop — the app scores how closely you matched.",
      "You get a few attempts per sentence. Pass the similarity threshold to move on.",
    ],
  },
  chado_pauri: {
    id: "chado_pauri",
    title: `How to play ${CHADO_PAURI_DISPLAY_NAME}`,
    steps: [
      "Climb a nine-rung ladder. Each correct answer moves you up a rung.",
      "One wrong answer ends your climb — bank what you've earned by climbing carefully.",
      "Lifelines (when available) can help on tough rungs. Higher rungs are worth more points.",
    ],
  },
  conversation_practice: {
    id: "conversation_practice",
    title: `How to play ${CONVERSATION_PRACTICE_DISPLAY_NAME}`,
    steps: [
      "Pick a character, then a scenario, then a difficulty (easy / medium / hard).",
      "Follow the dialogue: listen or read their line, then choose or build your reply.",
      "Use display settings to show or hide Gurmukhi, romanisation, and English as you like.",
    ],
  },
  possessive_practice: {
    id: "possessive_practice",
    title: `How to play ${KIHDA_DISPLAY_NAME}`,
    steps: [
      "You'll see an English prompt with a Punjabi noun — choose the right possessive (mera / meri / mere, etc.).",
      "Match gender and number (and oblique forms when the prompt asks for them).",
      "Pick filters and question count on the start screen, then work through the round.",
    ],
  },
  spot_the_mistake: {
    id: "spot_the_mistake",
    title: `How to play ${SPOT_THE_MISTAKE_DISPLAY_NAME}`,
    steps: [
      "Read the sentence and tap the word that's wrong.",
      "Then pick the correct fix from the options to repair the sentence.",
      "You get a couple of spotting attempts — after that the mistake is highlighted for you.",
    ],
  },
  comprehension_practice: {
    id: "comprehension_practice",
    title: `How to play ${COMPREHENSION_PRACTICE_DISPLAY_NAME}`,
    steps: [
      "Choose a length tier (Short / Medium / Long), then pick a script.",
      "Read and/or listen to the passage — you can replay individual sentences.",
      "When you're ready, answer the comprehension questions about what you just saw or heard.",
    ],
  },
  lane_runner: {
    id: "lane_runner",
    title: `How to play ${LANE_RUNNER_DISPLAY_NAME}`,
    steps: [
      "Steer between three lanes as answer gates fall toward you.",
      "Dash into the lane with the correct Punjabi answer — wrong lanes cost a life (you have three).",
      "Collect coins and letter pickups to spell KIDDA. Speed ramps up the longer you survive.",
    ],
  },
  speaking_practice: {
    id: "speaking_practice",
    title: "How to play Speaking Practice",
    steps: [
      "You'll see a vocab word in Punjabi (with romanisation) and its English meaning.",
      "Record yourself saying the word, then get a similarity score against the target.",
      "Pass the threshold to move on — you have a few attempts per word.",
    ],
  },
  vowel_match: {
    id: "vowel_match",
    title: "How to play Vowel Match",
    steps: [
      "A Punjabi word plays automatically. Tap Replay any time to hear it again.",
      "Select every matra you hear — some words have more than one.",
      "Submit to check. You need the exact set: no missing matras, and no extras.",
    ],
  },
  sound_match: {
    id: "sound_match",
    title: "How to play Sound Match",
    steps: [
      "A Punjabi letter plays automatically. Tap Replay any time to hear it again.",
      "Pick the letter you heard from a short list of commonly confused lookalikes.",
      "You'll get instant feedback, then the next letter plays on its own.",
    ],
  },
  word_start: {
    id: "word_start",
    title: "How to play Word Start",
    steps: [
      "A Punjabi word plays automatically. Tap Replay any time to hear it again.",
      "Pick the letter the word starts with from a short list of lookalikes.",
      "You'll get instant feedback, then the next word plays on its own.",
    ],
  },
  buzz_in: {
    id: "buzz_in",
    title: "How to play Buzz-in",
    steps: [
      "Everyone sees the same English prompt at once — first to know the answer taps BUZZ!",
      "Only the player who buzzes in gets to pick the Punjabi answer. Wrong or too slow → the round moves on.",
      "Correct answers earn points. Spectators (host not playing) watch without buzzing.",
      "Keep going through the question list — the scoreboard updates live.",
    ],
  },
  jeopardy: {
    id: "jeopardy",
    title: "How to play Jeopardy",
    steps: [
      "One player picks a category tile (Alphabet, Vocab, or Sentences) and a point value.",
      "When the question opens, anyone playing can tap BUZZ! — first buzz locks in who answers.",
      "Only the buzzer chooses from the options. Correct = those points; wrong or timeout = no score for that tile.",
      "After each tile, the next picker chooses. Cleared tiles stay crossed off until the board is done.",
    ],
  },
  point_race: {
    id: "point_race",
    title: "How to play Point Race",
    steps: [
      "Every player races on their own questions at their own pace — no shared buzz.",
      "Pick the correct Punjabi translation for each English prompt to earn a point.",
      "First player to hit the room's target score wins. Spectators can watch the live standings.",
    ],
  },
  sound_match_group: {
    id: "sound_match_group",
    title: "How to play Sound Match (group)",
    steps: [
      "Every player races on their own letter audio at their own pace — no shared buzz.",
      "Listen and pick the letter you heard. Replay as many times as you need.",
      "First player to hit the room's target score wins. Spectators can watch the live standings.",
    ],
  },
  vowel_match_group: {
    id: "vowel_match_group",
    title: "How to play Vowel Match (group)",
    steps: [
      "Every player races on their own spoken words at their own pace — no shared buzz.",
      "Select every matra you hear, then submit. You need the exact set to score.",
      "First player to hit the room's target score wins. Spectators can watch the live standings.",
    ],
  },
  chado_pauri_group: {
    id: "chado_pauri_group",
    title: `How to play ${CHADO_PAURI_DISPLAY_NAME} (group)`,
    steps: [
      "Players take turns in the hot seat climbing the shared ladder.",
      "When it's your turn, answer the multiple-choice prompt — one wrong answer ends that climb.",
      "Shared lifelines (Ask the Room, 50/50, Ask Tutor) can help when the room settings allow them.",
      "Watch the scoreboard — climb higher rungs for bigger points for your run.",
    ],
  },
  sentence_builder_group: {
    id: "sentence_builder_group",
    title: "How to play Sentence Builder (group)",
    steps: [
      "The room builds one Punjabi sentence together, tile by tile.",
      "On your turn, pick a word from the pool to place next in the sentence.",
      "Wrong tiles bounce back; correct tiles lock in. English is revealed when the sentence is complete.",
      "Take turns until the round finishes — scores update on the shared board.",
    ],
  },
};

export function getTutorialContent(id: TutorialId): GameTutorialContent {
  return TUTORIALS[id];
}

export function listTutorialIds(): TutorialId[] {
  return Object.keys(TUTORIALS) as TutorialId[];
}
