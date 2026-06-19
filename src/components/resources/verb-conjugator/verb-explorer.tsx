"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { conjugate } from "@/lib/conjugation/conjugate";
import {
  PERSON_OPTIONS,
  TENSE_CATALOG,
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

function ConjugationResultCard({
  result,
}: {
  result: ReturnType<typeof conjugate>;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
        {result.englishGloss}
      </p>

      <div className="mt-4 text-2xl leading-relaxed text-zinc-900">
        <span>{result.pronoun} </span>
        <span>
          {result.root}
          <span className="text-violet-600">{result.ending}</span>
        </span>
        {result.auxiliary && (
          <>
            {" "}
            <span className="text-amber-600">{result.auxiliary}</span>
          </>
        )}
      </div>

      <div className="mt-2 text-base text-zinc-500">
        <span>{result.pronounRomanised} </span>
        <span>
          {result.root}
          <span className="text-violet-500">{result.endingRomanised}</span>
        </span>
        {result.auxiliaryRomanised && (
          <>
            {" "}
            <span className="text-amber-500">{result.auxiliaryRomanised}</span>
          </>
        )}
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

  const tensesInGroup = TENSE_CATALOG.filter((t) => t.group === tenseGroup);

  const result = useMemo(
    () => conjugate(verb, tenseId, person, gender),
    [verb, tenseId, person, gender]
  );

  const ending = infinitiveEnding(verb.infinitive, verb.root);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/games/verb-conjugator"
          className="text-sm font-medium text-violet-600 hover:text-violet-500"
        >
          ← All verbs
        </Link>
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
                onClick={() => setPerson(option.person)}
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
          </p>
          <div className="flex gap-2">
            {(["masculine", "feminine"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setGender(value)}
                className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
                  gender === value
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ConjugationResultCard result={result} />
    </div>
  );
}
