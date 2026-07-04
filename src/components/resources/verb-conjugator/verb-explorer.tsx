"use client";

import { BackLink } from "@/components/navigation/back-link";
import { useMemo, useState } from "react";
import Link from "next/link";
import { conjugate } from "@/lib/conjugation/conjugate";
import { verbPhraseDisplayParts } from "@/lib/conjugation/format";
import { latinRomanised } from "@/lib/conjugation/romanised";
import { personLocksMasculineGender } from "@/lib/conjugation/pronouns";
import {
  PERSON_OPTIONS,
  TENSE_CATALOG,
  type ConjugationResult,
  type Gender,
  type Person,
  type TenseGroup,
  type TenseId,
  type Verb,
} from "@/lib/conjugation/types";

const TENSE_GROUPS: { id: TenseGroup; label: string }[] = [
  { id: "present", label: "Present" },
  { id: "past", label: "Past" },
  { id: "future", label: "Future" },
];

function infinitiveEnding(infinitive: string, root: string): string {
  if (infinitive.endsWith(root)) {
    return infinitive.slice(root.length);
  }
  return "ਣਾ";
}

function VerbPhraseLine({
  pronoun,
  stem,
  ending,
  layout,
  auxiliary,
  endingClassName,
  auxiliaryClassName,
}: {
  pronoun: string;
  stem: string;
  ending: string;
  layout: ConjugationResult["verbWordLayout"];
  auxiliary: string | null;
  endingClassName: string;
  auxiliaryClassName: string;
}) {
  const { prefix, suffix } = verbPhraseDisplayParts(stem, ending, layout);
  const spacedSuffix = suffix && layout === "separate_words";

  return (
    <>
      <span>{pronoun} </span>
      <span>
        {prefix}
        {suffix && (
          <>
            {spacedSuffix ? " " : null}
            <span className={endingClassName}>{suffix}</span>
          </>
        )}
      </span>
      {auxiliary && (
        <>
          {" "}
          <span className={auxiliaryClassName}>{auxiliary}</span>
        </>
      )}
    </>
  );
}

function ConjugationResultCard({
  result,
}: {
  result: ReturnType<typeof conjugate>;
}) {
  const stemRomanised = latinRomanised(result.stemRomanised) ?? "";
  const endingRomanised = latinRomanised(result.endingRomanised) ?? "";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {result.englishGloss}
      </p>

      <div className="mt-4 text-2xl leading-relaxed text-zinc-900">
        <VerbPhraseLine
          pronoun={result.pronoun}
          stem={result.root}
          ending={result.ending}
          layout={result.verbWordLayout}
          auxiliary={result.auxiliary}
          endingClassName="text-violet-600"
          auxiliaryClassName="text-amber-600"
        />
      </div>

      <div className="mt-2 text-base text-zinc-500">
        <VerbPhraseLine
          pronoun={result.pronounRomanised}
          stem={stemRomanised}
          ending={endingRomanised}
          layout={result.verbWordLayout}
          auxiliary={result.auxiliaryRomanised}
          endingClassName="text-violet-500"
          auxiliaryClassName="text-amber-500"
        />
      </div>

      <p className="mt-4 text-sm text-zinc-500">{result.explanation}</p>
    </div>
  );
}

type VerbConjugatorExplorerProps = {
  verb: Verb;
};

export function VerbConjugatorExplorer({ verb }: VerbConjugatorExplorerProps) {
  const [tenseGroup, setTenseGroup] = useState<TenseGroup>("present");
  const [tenseId, setTenseId] = useState<TenseId>("present_habitual");
  const [person, setPerson] = useState<Person>("I");
  const [gender, setGender] = useState<Gender>("masculine");

  const genderLocked = personLocksMasculineGender(person);
  const effectiveGender: Gender = genderLocked ? "masculine" : gender;

  const tensesInGroup = TENSE_CATALOG.filter((t) => t.group === tenseGroup);

  const result = useMemo(
    () => conjugate(verb, tenseId, person, effectiveGender),
    [verb, tenseId, person, effectiveGender]
  );

  function handlePersonChange(next: Person) {
    setPerson(next);
    if (personLocksMasculineGender(next)) {
      setGender("masculine");
    }
  }

  const ending = infinitiveEnding(verb.infinitive, verb.root);

  return (
    <div className="space-y-5">
      <div>
        <BackLink fallbackHref="/dashboard/games/verb-conjugator" className="text-sm font-medium text-violet-600 hover:text-violet-500">← All verbs</BackLink>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900">
          {verb.english}
        </h1>
        <p className="mt-2 text-3xl text-zinc-900">
          <span>{verb.root}</span>
          <span className="text-zinc-400">{ending}</span>
        </p>
        {verb.infinitiveRomanised && (
          <p className="mt-1 text-sm text-violet-600">{verb.infinitiveRomanised}</p>
        )}
        {verb.notes && (
          <p className="mt-2 text-xs text-zinc-500">{verb.notes}</p>
        )}
      </div>

      <div className="flex gap-2">
        {TENSE_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => {
              setTenseGroup(group.id);
              const first = TENSE_CATALOG.find((t) => t.group === group.id);
              if (first) setTenseId(first.id);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tenseGroup === group.id
                ? "bg-violet-600 text-white"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            {group.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {tensesInGroup.map((tense) => (
          <button
            key={tense.id}
            type="button"
            onClick={() => setTenseId(tense.id)}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              tenseId === tense.id
                ? "border border-violet-300 bg-violet-50 text-violet-800"
                : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
            }`}
          >
            {tense.shortLabel}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Person
          </p>
          <div className="flex flex-wrap gap-2">
            {PERSON_OPTIONS.map((option) => (
              <button
                key={option.person}
                type="button"
                onClick={() => handlePersonChange(option.person)}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  person === option.person
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">
            Gender
            {genderLocked && (
              <span className="ml-1 normal-case tracking-normal text-zinc-500">
                (masculine only for {person === "we" ? "we" : "you"})
              </span>
            )}
          </p>
          <div className="flex gap-2">
            {(["masculine", "feminine"] as const).map((value) => {
              const disabled = genderLocked && value === "feminine";
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled}
                  onClick={() => setGender(value)}
                  className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
                    effectiveGender === value
                      ? "bg-zinc-900 text-white"
                      : disabled
                        ? "cursor-not-allowed bg-zinc-50 text-zinc-300"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ConjugationResultCard result={result} />
    </div>
  );
}
