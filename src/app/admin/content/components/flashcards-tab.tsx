"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createFlashcard,
  deleteFlashcard,
  type ActionResult,
} from "../actions";
import type { AdminData } from "../types";
import {
  FormMessage,
  SectionCard,
  buttonClass,
  dangerButtonClass,
  inputClass,
  labelClass,
} from "./ui";

const initialState: ActionResult = {};

export function FlashcardsTab({ data }: { data: AdminData }) {
  const [state, action, pending] = useActionState(createFlashcard, initialState);

  const decks = data.flashcards.reduce<Record<string, AdminData["flashcards"]>>(
    (acc, card) => {
      if (!acc[card.deck_name]) acc[card.deck_name] = [];
      acc[card.deck_name].push(card);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6">
      <SectionCard title="Add flashcard">
        <form action={action} className="space-y-4">
          <div>
            <label className={labelClass}>Deck name</label>
            <input
              name="deck_name"
              required
              placeholder="e.g. Greetings"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Front text</label>
            <textarea name="front_text" required rows={2} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Back text</label>
            <textarea name="back_text" required rows={2} className={inputClass} />
          </div>
          <FormMessage state={state} />
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Saving…" : "Add flashcard"}
          </button>
        </form>
      </SectionCard>

      <SectionCard title={`Flashcards (${data.flashcards.length})`}>
        {Object.keys(decks).length === 0 ? (
          <p className="text-sm text-zinc-500">No flashcards yet.</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(decks).map(([deckName, cards]) => (
              <div key={deckName}>
                <h4 className="font-semibold text-violet-700">{deckName}</h4>
                <ul className="mt-3 divide-y divide-zinc-100 rounded-lg border border-zinc-100">
                  {cards.map((card) => (
                    <li
                      key={card.id}
                      className="flex items-start justify-between gap-3 p-3 text-sm"
                    >
                      <div>
                        <p className="font-medium text-zinc-900">
                          {card.front_text}
                        </p>
                        <p className="mt-1 text-zinc-500">{card.back_text}</p>
                      </div>
                      <DeleteFlashcardButton id={card.id} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function DeleteFlashcardButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className={dangerButtonClass}
      onClick={async () => {
        if (!confirm("Delete this flashcard?")) return;
        setPending(true);
        await deleteFlashcard(id);
        router.refresh();
        setPending(false);
      }}
    >
      Delete
    </button>
  );
}
