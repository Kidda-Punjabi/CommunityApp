import {
  homeworkQuestionAid,
  type HomeworkQuestion,
} from "@/lib/tutoring/homework-question-display";

export function HomeworkQuestionList({ questions }: { questions: HomeworkQuestion[] }) {
  if (questions.length === 0) return null;

  return (
    <ol className="space-y-3">
      {questions.map((question) => {
        const aid = homeworkQuestionAid(question);
        return (
          <li
            key={question.id}
            className="rounded-3xl border border-zinc-200/60 bg-white p-5 shadow-[0_4px_24px_-6px_rgba(24,24,27,0.08)]"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
              {question.questionNumber} of {questions.length}
            </p>
            <p className="mt-1 text-base font-medium text-zinc-900">{question.promptEnglish}</p>
            {aid.lookSayGurmukhi ? (
              <div className="mt-3 rounded-2xl bg-violet-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">
                  Practise saying
                </p>
                <p className="mt-1 font-heading text-2xl leading-snug text-zinc-900">
                  {aid.lookSayGurmukhi}
                </p>
                {aid.lookSayRomanised ? (
                  <p className="mt-1 text-sm text-violet-700">{aid.lookSayRomanised}</p>
                ) : null}
              </div>
            ) : null}
            {aid.exampleGuidance ? (
              <p className="mt-3 text-sm text-zinc-500">
                <span className="font-medium text-zinc-600">Example:</span> {aid.exampleGuidance}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
