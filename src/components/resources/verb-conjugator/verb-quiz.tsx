"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { conjugate } from "@/lib/conjugation/conjugate";
import {
  PERSON_OPTIONS,
  TENSE_CATALOG,
  type Gender,
  type Person,
  type TenseId,
  type Verb,
} from "@/lib/conjugation/types";

type QuizPhase = "question" | "answered";

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildQuestion(verbs: Verb[]) {
  const verb = pickRandom(verbs);
  const tense = pickRandom(TENSE_CATALOG);
  const personOption = pickRandom(PERSON_OPTIONS);
  const gender: Gender = Math.random() > 0.5 ? "masculine" : "feminine";

  const correct = conjugate(verb, tense.id, personOption.person, gender);

  const distractors = new Map<string, string>();
  while (distractors.size < 3) {
    const otherVerb = pickRandom(verbs);
    const otherTense = pickRandom(TENSE_CATALOG);
    const otherPerson = pickRandom(PERSON_OPTIONS);
    const otherGender: Gender = Math.random() > 0.5 ? "masculine" : "feminine";
    const wrong = conjugate(otherVerb, otherTense.id, otherPerson.person, otherGender);
    if (wrong.fullPunjabi !== correct.fullPunjabi) {
      distractors.set(wrong.fullPunjabi, wrong.fullRomanised);
    }
  }

  const options = [correct.fullPunjabi, ...distractors.keys()].sort(() => Math.random() - 0.5);
  const romanisedByOption: Record<string, string> = {
    [correct.fullPunjabi]: correct.fullRomanised,
    ...Object.fromEntries(distractors),
  };

  return {
    verb,
    tenseId: tense.id as TenseId,
    tenseLabel: tense.label,
    person: personOption.person as Person,
    personLabel: personOption.label,
    gender,
    correct,
    options,
    romanisedByOption,
    prompt: `How do you say "${correct.englishGloss}"?`,
  };
}

type VerbConjugatorQuizProps = {
  verbs: Verb[];
};

export function VerbConjugatorQuiz({ verbs }: VerbConjugatorQuizProps) {
  const [question, setQuestion] = useState(() => (verbs.length ? buildQuestion(verbs) : null));
  const [phase, setPhase] = useState<QuizPhase>("question");
  const [selected, setSelected] = useState<string | null>(null);

  const nextQuestion = useCallback(() => {
    setQuestion(buildQuestion(verbs));
    setPhase("question");
    setSelected(null);
  }, [verbs]);

  const isCorrect = useMemo(
    () => selected !== null && selected === question?.correct.fullPunjabi,
    [selected, question]
  );

  if (!verbs.length || !question) {
    return (
      <div className="space-y-4">
        <BackLink fallbackHref="/dashboard/games/verb-conjugator" className="text-sm font-medium text-violet-600 hover:text-violet-500">← All verbs</BackLink>
        <p className="text-sm text-zinc-500">No verbs available for quiz.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <BackLink fallbackHref="/dashboard/games/verb-conjugator" className="text-sm font-medium text-violet-600 hover:text-violet-500">← All verbs</BackLink>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">Verb Quiz</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Multiple choice — no scores, just practice.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-violet-600">
          {question.tenseLabel} · {question.personLabel} · {question.gender}
        </p>
        <p className="mt-2 text-sm text-zinc-500">{question.verb.english}</p>
        <p className="mt-3 text-lg font-medium text-zinc-900">{question.prompt}</p>
      </div>

      <div className="space-y-2">
        {question.options.map((option) => {
          const isSelected = selected === option;
          const isAnswer = option === question.correct.fullPunjabi;
          let className =
            "w-full rounded-xl border px-4 py-3.5 text-left text-lg transition-colors ";

          if (phase === "answered") {
            if (isAnswer) {
              className += "border-green-300 bg-green-50 text-green-900";
            } else if (isSelected) {
              className += "border-red-300 bg-red-50 text-red-900";
            } else {
              className += "border-zinc-200 bg-white text-zinc-600";
            }
          } else {
            className +=
              "border-zinc-200 bg-white text-zinc-900 hover:border-violet-300 hover:bg-violet-50";
          }

          return (
            <button
              key={option}
              type="button"
              disabled={phase === "answered"}
              onClick={() => {
                setSelected(option);
                setPhase("answered");
              }}
              className={className}
            >
              <span className="block font-medium">{option}</span>
              {question.romanisedByOption[option] ? (
                <span className="mt-0.5 block text-sm font-normal text-zinc-500">
                  {question.romanisedByOption[option]}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {phase === "answered" && (
        <div className="space-y-3">
          <p
            className={`text-sm font-medium ${isCorrect ? "text-green-700" : "text-red-700"}`}
          >
            {isCorrect ? "Correct!" : "Not quite."}
          </p>
          {!isCorrect && (
            <p className="text-sm text-zinc-600">
              Answer:{" "}
              <span className="font-medium">
                {question.correct.fullPunjabi}
                {question.correct.fullRomanised
                  ? ` (${question.correct.fullRomanised})`
                  : ""}
              </span>
            </p>
          )}
          <button
            type="button"
            onClick={nextQuestion}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
          >
            Next question
          </button>
        </div>
      )}
    </div>
  );
}
