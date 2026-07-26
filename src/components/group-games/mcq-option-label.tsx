import { ChadoPauriGroupOptionLabel } from "@/components/group-games/chado-pauri-group-option-label";
import type { McqQuestionPayload } from "@/lib/group-games/buzz-race-types";

export function mcqOptionRomanised(
  question: McqQuestionPayload,
  option: string
): string | null {
  const index = question.options.indexOf(option);
  if (index < 0) return null;
  return question.options_romanised?.[index] ?? null;
}

export function McqOptionLabel({
  question,
  option,
}: {
  question: McqQuestionPayload;
  option: string;
}) {
  return (
    <ChadoPauriGroupOptionLabel
      gurmukhi={option}
      romanised={mcqOptionRomanised(question, option)}
    />
  );
}
