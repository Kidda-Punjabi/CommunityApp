import type { LevelMeta } from "./types";

/** Arena, goal and tutor-led speaking test for each level, from the Kidda Level Criteria. */
export const LEVELS: LevelMeta[] = [
  { level: 0, name: "The Gate", gurmukhi: "ਦਰਵਾਜ਼ਾ", stage: "Starting out", can: "I don't speak any Punjabi yet", wordsTotal: null, speakingTest: "A voice note: every row of the sound map, then 10 practice words." },
  { level: 1, name: "Ghar", gurmukhi: "ਘਰ", stage: "Beginner", can: "I can greet family and introduce myself", wordsTotal: "50", speakingTest: "Greet, say your name, where you're from and what you do, then answer the 6 questions with no notes." },
  { level: 2, name: "Rasoi", gurmukhi: "ਰਸੋਈ", stage: "Beginner", can: "I can build my own simple sentences", wordsTotal: "200", speakingTest: "1 minute of your own sentences with no notes, then 5 questions using want, need and can." },
  { level: 3, name: "Gali", gurmukhi: "ਗਲੀ", stage: "Beginner", can: "I can have simple conversations in different tenses", wordsTotal: "350", speakingTest: "A 3 to 5 minute conversation on the Week 12 brief, covering past, present and future." },
  { level: 4, name: "Khet", gurmukhi: "ਖੇਤ", stage: "Intermediate", can: "I can talk about my day and my plans", wordsTotal: "500", speakingTest: "A role play with an unprepared question, ask the tutor one, then talk about yesterday and next week with no script." },
  { level: 5, name: "Bazaar", gurmukhi: "ਬਾਜ਼ਾਰ", stage: "Intermediate", can: "I can keep a simple conversation going", wordsTotal: "750", speakingTest: "A role play, then describe a photo for 2 minutes without switching to English." },
  { level: 6, name: "Dhaba", gurmukhi: "ਢਾਬਾ", stage: "Intermediate", can: "I can chat for 3 to 5 minutes", wordsTotal: "1,000", speakingTest: "Draw a topic, prep 10 to 15 minutes, a 5-minute conversation with an unprepared question, then a photo card." },
  { level: 7, name: "Station", gurmukhi: "ਸਟੇਸ਼ਨ", stage: "Advanced", can: "I can share my opinions and make jokes", wordsTotal: "1,500", speakingTest: "3 to 5 minutes defending an opinion on a random topic, a persuasion role play and a funny story." },
  { level: 8, name: "Mela", gurmukhi: "ਮੇਲਾ", stage: "Advanced", can: "I can keep up with fast group conversations", wordsTotal: "2,000", speakingTest: "4 to 5 minutes in a group of 3 or 4: join in, interrupt politely and react, with no tutor leading." },
  { level: 9, name: "Viah", gurmukhi: "ਵਿਆਹ", stage: "Advanced", can: "I can hold complex, fluent conversations", wordsTotal: "3,000+", speakingTest: "10 minutes unprepared on a complex topic: argue a side, handle being challenged and stay in Punjabi." },
];

/** Turn off to hide every "Drafted, needs check" row from learners until a tutor has checked it. */
export const INCLUDE_DRAFTED_CONTENT = true;

export const ROUND_SIZE = 12;
/** Correct answers before a word or sentence counts as done on the checklist. */
export const ITEM_DONE_AT = 2;
/** Correct answers per star on a grammar rule. Three stars ticks the rule. */
export const RULE_CORRECT_PER_STAR = 4;

export const XP_PER_CORRECT = 2;
export const XP_ROUND_BONUS = 5;
export const DAILY_XP_GOAL = 50;
