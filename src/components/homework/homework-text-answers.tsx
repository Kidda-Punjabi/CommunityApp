import type { PendingHomeworkReviewRow } from "@/lib/tutoring/homework-submissions";

type HomeworkTextAnswersProps = {
  textAnswers: PendingHomeworkReviewRow["textAnswers"];
  answerKeys: PendingHomeworkReviewRow["answerKeys"];
};

export function HomeworkTextAnswers({ textAnswers, answerKeys }: HomeworkTextAnswersProps) {
  return (
    <div className="space-y-3">
      {textAnswers?.map((answer) => {
        const key = answerKeys.find((row) => row.questionNumber === answer.question_number);
        return (
          <div
            key={answer.question_number}
            className="rounded-xl border border-zinc-200 px-3 py-2"
          >
            <p className="text-sm font-medium text-zinc-900">
              {answer.question_number}. {key?.promptEnglish ?? "Question"}
            </p>
            <p className="mt-1 text-sm text-zinc-700">Student: {answer.answer_text || "—"}</p>
            {key ? (
              <p className="mt-1 text-xs text-zinc-500">
                Answer key: {key.answerGurmukhi ? `${key.answerGurmukhi} / ` : ""}
                {key.answerRomanised}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
