import {
  matchSpeakingTranscript,
  passedSpeakingAttempt,
} from "@/lib/games/speaking-practice";

export type TypedAnswerTarget = {
  romanised: string;
  gurmukhi?: string | null;
};

/** Reuses Speaking Practice fuzzy match — accepts minor romanisation variation. */
export function scoreTypedAnswer(
  userInput: string,
  target: string | TypedAnswerTarget
): number {
  if (typeof target === "string") {
    return matchSpeakingTranscript(userInput, target);
  }
  return matchSpeakingTranscript(userInput, {
    romanised: target.romanised,
    punjabi: target.gurmukhi ?? undefined,
  });
}

export function passedTypedAnswer(
  userInput: string,
  target: string | TypedAnswerTarget
): boolean {
  return passedSpeakingAttempt(scoreTypedAnswer(userInput, target));
}
