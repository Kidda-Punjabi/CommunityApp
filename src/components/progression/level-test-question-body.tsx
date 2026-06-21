"use client";

import { useEffect, useState } from "react";
import { answersMatch } from "@/lib/conjugation/sentence-builder";
import type {
  LevelTestConjugationQuestion,
  LevelTestMcqQuestion,
  LevelTestQuestion,
  LevelTestSentenceBuilderQuestion,
  LevelTestSentenceTile,
} from "@/lib/progression/level-tests";
import { EnglishWithGenderMarkers } from "@/components/english-with-gender-markers";
import { ui } from "@/lib/ui/styles";

type LevelTestQuestionBodyProps = {
  question: LevelTestQuestion;
  locked: boolean;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string, isCorrect: boolean) => void;
  onSentenceBuilderAnswer: (isCorrect: boolean) => void;
};

function PunjabiWithRomanised({
  punjabi,
  romanised,
  punjabiClassName = "font-semibold text-zinc-900",
  romanisedClassName = "font-normal text-violet-600",
}: {
  punjabi: string;
  romanised?: string;
  punjabiClassName?: string;
  romanisedClassName?: string;
}) {
  return (
    <span className="flex w-full flex-col items-center text-center gap-0.5">
      <span className={`text-lg ${punjabiClassName}`}>{punjabi}</span>
      {romanised ? (
        <span className={`text-sm ${romanisedClassName}`}>{romanised}</span>
      ) : null}
    </span>
  );
}

function McqPrompt({ question }: { question: LevelTestMcqQuestion }) {
  return (
    <div className="space-y-2 text-center">
      {question.questionGurmukhi ? (
        <p className="text-3xl font-semibold text-zinc-900">{question.questionGurmukhi}</p>
      ) : null}
      {question.questionRomanised ? (
        <p className="text-lg text-violet-600">{question.questionRomanised}</p>
      ) : null}
      <p className="text-lg font-semibold leading-snug text-zinc-900">
        {question.questionEnglish}
      </p>
    </div>
  );
}

function McqOptionLabel({ option }: { option: LevelTestMcqQuestion["options"][number] }) {
  const hasGurmukhi = Boolean(option.textGurmukhi);
  const hasRomanised = Boolean(option.textRomanised);
  const hasEnglish = Boolean(option.textEnglish);

  if (hasGurmukhi) {
    return (
      <PunjabiWithRomanised
        punjabi={option.textGurmukhi ?? ""}
        romanised={option.textRomanised}
      />
    );
  }

  if (hasRomanised && !hasEnglish) {
    return <span className="text-base font-medium text-violet-600">{option.textRomanised}</span>;
  }

  if (hasEnglish && hasRomanised) {
    return (
      <span className="flex flex-col items-center text-center gap-0.5">
        <span className="text-base font-medium text-zinc-900">{option.textEnglish}</span>
        <span className="text-sm font-normal text-violet-600">{option.textRomanised}</span>
      </span>
    );
  }

  return (
    <span className="text-base font-medium text-zinc-900">
      {option.textEnglish ?? option.textRomanised ?? option.textGurmukhi ?? "Option"}
    </span>
  );
}

function McqQuestionBody({
  question,
  locked,
  selectedOptionId,
  onSelectOption,
}: {
  question: LevelTestMcqQuestion;
  locked: boolean;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string, isCorrect: boolean) => void;
}) {
  return (
    <>
      <div className={`${ui.card} bg-white text-zinc-900 [color-scheme:light]`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Multiple choice
        </p>
        <div className="mt-3">
          <McqPrompt question={question} />
        </div>
      </div>

      <div className="grid gap-2">
        {question.options.map((option, index) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrect = option.id === question.correctOptionId;
          const showResult = locked;

          let className =
            "w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ";

          if (!showResult) {
            className +=
              "border-zinc-300 bg-white text-zinc-900 shadow-sm hover:border-violet-400 hover:bg-violet-50";
          } else if (isCorrect) {
            className += "border-green-500 bg-green-50 text-green-900";
          } else if (isSelected) {
            className += "border-red-500 bg-red-50 text-red-900";
          } else {
            className += "border-zinc-200 bg-zinc-100 text-zinc-800";
          }

          return (
            <button
              key={option.id}
              type="button"
              aria-disabled={locked}
              onClick={() =>
                onSelectOption(option.id, option.id === question.correctOptionId)
              }
              className={`${className}${locked ? " pointer-events-none" : ""}`}
            >
              <span className="flex items-center gap-3">
                <span className="shrink-0 font-semibold uppercase text-zinc-500">
                  {String.fromCharCode(97 + index)}.
                </span>
                <span className="flex-1 text-center">
                  <McqOptionLabel option={option} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function ConjugationQuestionBody({
  question,
  locked,
  selectedOptionId,
  onSelectOption,
}: {
  question: LevelTestConjugationQuestion;
  locked: boolean;
  selectedOptionId: string | null;
  onSelectOption: (optionId: string, isCorrect: boolean) => void;
}) {
  return (
    <>
      <div className={`${ui.card} bg-white text-zinc-900 [color-scheme:light] text-center`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Pick the correct verb form
        </p>
        <p className="mt-3 text-xl font-semibold text-zinc-900">
          {question.punjabiSentenceWithBlank}
        </p>
        <EnglishWithGenderMarkers
          as="p"
          text={question.englishTranslation}
          className="mt-2 text-base text-zinc-700"
        />
      </div>

      <div className="grid gap-2">
        {question.options.map((option) => {
          const isSelected = selectedOptionId === option.id;
          const isCorrect = option.id === question.correctOptionId;
          const showResult = locked;

          let className =
            "relative flex flex-col items-center justify-center rounded-xl border px-3 py-3 text-center text-sm font-medium transition-colors ";

          if (!showResult) {
            className +=
              "border-zinc-200 bg-white text-zinc-900 hover:border-violet-300 hover:bg-violet-50";
          } else if (isCorrect) {
            className += "border-green-400 bg-green-50 text-green-900";
          } else if (isSelected) {
            className += "border-red-400 bg-red-50 text-red-900";
          } else {
            className += "border-zinc-200 bg-zinc-100 text-zinc-800";
          }

          return (
            <button
              key={option.id}
              type="button"
              aria-disabled={locked}
              onClick={() =>
                onSelectOption(option.id, option.id === question.correctOptionId)
              }
              className={`${className}${locked ? " pointer-events-none" : ""}`}
            >
              <PunjabiWithRomanised
                punjabi={option.gurmukhi}
                romanised={option.romanised}
                punjabiClassName="font-medium"
                romanisedClassName={
                  showResult && isCorrect
                    ? "font-normal text-green-700"
                    : showResult && isSelected
                      ? "font-normal text-red-700"
                      : "font-normal text-violet-600"
                }
              />
            </button>
          );
        })}
      </div>
    </>
  );
}

function SentenceBuilderQuestionBody({
  question,
  locked,
  onSentenceBuilderAnswer,
}: {
  question: LevelTestSentenceBuilderQuestion;
  locked: boolean;
  onSentenceBuilderAnswer: (isCorrect: boolean) => void;
}) {
  const [bank, setBank] = useState<LevelTestSentenceTile[]>(question.tiles);
  const [built, setBuilt] = useState<LevelTestSentenceTile[]>([]);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  useEffect(() => {
    setBank(question.tiles);
    setBuilt([]);
    setFeedback(null);
  }, [question.id, question.tiles]);

  function moveToBuilt(tile: LevelTestSentenceTile) {
    if (locked || feedback) return;
    setBank((current) => current.filter((entry) => entry.id !== tile.id));
    setBuilt((current) => [...current, tile]);
  }

  function moveToBank(tile: LevelTestSentenceTile) {
    if (locked || feedback) return;
    setBuilt((current) => current.filter((entry) => entry.id !== tile.id));
    setBank((current) => [...current, tile]);
  }

  function handleCheck() {
    if (locked || feedback || built.length === 0) return;

    const isCorrect = answersMatch(
      built.map((tile) => tile.gurmukhi),
      question.correctTiles
    );
    setFeedback(isCorrect ? "correct" : "wrong");
    onSentenceBuilderAnswer(isCorrect);
  }

  return (
    <>
      <div className={`${ui.card} bg-white text-zinc-900 [color-scheme:light] text-center`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          Form the sentence in Punjabi
        </p>
        <EnglishWithGenderMarkers
          as="p"
          text={question.englishPrompt}
          className="mt-3 text-lg font-semibold text-zinc-900"
        />
      </div>

      <div
        className={`min-h-20 rounded-xl border-2 border-dashed p-3 transition-colors ${
          feedback === "correct"
            ? "border-green-300 bg-green-50"
            : feedback === "wrong"
              ? "border-red-300 bg-red-50"
              : "border-violet-200 bg-violet-50/50"
        }`}
      >
        <div className="flex min-h-10 flex-wrap gap-2">
          {built.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => moveToBank(tile)}
              disabled={Boolean(feedback) || locked}
              className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-80"
            >
              <span>{tile.gurmukhi}</span>
              {tile.romanised ? (
                <span className="mt-0.5 block text-xs font-normal text-violet-200">
                  {tile.romanised}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {feedback === "wrong" ? (
        <p className="text-center text-sm font-medium text-zinc-900">
          {question.correctTiles.join(" ")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {bank.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => moveToBuilt(tile)}
            disabled={Boolean(feedback) || locked}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-900 hover:border-violet-300 disabled:opacity-70"
          >
            <span>{tile.gurmukhi}</span>
            {tile.romanised ? (
              <span className="mt-0.5 block text-xs font-normal text-violet-600">
                {tile.romanised}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleCheck}
        disabled={built.length === 0 || Boolean(feedback) || locked}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
      >
        Check
      </button>
    </>
  );
}

export function LevelTestQuestionBody({
  question,
  locked,
  selectedOptionId,
  onSelectOption,
  onSentenceBuilderAnswer,
}: LevelTestQuestionBodyProps) {
  switch (question.kind) {
    case "mcq":
      return (
        <McqQuestionBody
          question={question}
          locked={locked}
          selectedOptionId={selectedOptionId}
          onSelectOption={onSelectOption}
        />
      );
    case "conjugation_fill_blank":
      return (
        <ConjugationQuestionBody
          question={question}
          locked={locked}
          selectedOptionId={selectedOptionId}
          onSelectOption={onSelectOption}
        />
      );
    case "sentence_builder":
      return (
        <SentenceBuilderQuestionBody
          question={question}
          locked={locked}
          onSentenceBuilderAnswer={onSentenceBuilderAnswer}
        />
      );
    default:
      return null;
  }
}
