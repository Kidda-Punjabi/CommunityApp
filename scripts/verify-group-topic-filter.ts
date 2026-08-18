/**
 * Production check: pick Buzz-in questions via topic_tags overlap (anywhere in the array),
 * write two throwaway rooms, and print game_room_rounds for independent verification.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/verify-group-topic-filter.ts
 */

type Card = {
  id: string;
  front_text: string;
  back_text: string;
  romanised: string | null;
  topic_tags: string[];
};

type RoundRow = {
  round_number: number;
  question_payload: { flashcard_id: string; prompt: string; correct_answer: string };
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function restHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

async function rest<T>(url: string, key: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...restHeaders(key), ...(init.headers ?? {}) },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status}): ${text.slice(0, 800)}`);
  }
  return text ? (JSON.parse(text) as T) : (null as T);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function buildPayload(card: Card, pool: Card[]) {
  const distractors = shuffle(pool.filter((c) => c.id !== card.id && c.back_text !== card.back_text))
    .slice(0, 3)
    .map((c) => c.back_text);
  const options = shuffle([card.back_text, ...distractors]);
  return {
    flashcard_id: card.id,
    prompt: card.front_text,
    prompt_romanised: null,
    correct_answer: card.back_text,
    options,
    options_romanised: options.map(() => null),
  };
}

async function pickCards(url: string, key: string, tag: string): Promise<Card[]> {
  const cards = await rest<Card[]>(
    url,
    key,
    `flashcards?select=id,front_text,back_text,romanised,topic_tags&topic_tags=ov.{${tag}}&limit=50`
  );
  const matching = cards.filter((card) =>
    (card.topic_tags ?? []).map((t) => t.toLowerCase()).includes(tag)
  );
  assert(matching.length >= 4, `Overlap query for ${tag} returned ${matching.length} cards`);
  return shuffle(matching).slice(0, 10);
}

async function createTestRoom(
  url: string,
  key: string,
  hostId: string,
  tag: string,
  cards: Card[]
): Promise<string> {
  const joinCode = `TF${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const rooms = await rest<{ id: string }[]>(url, key, "game_rooms", {
    method: "POST",
    body: JSON.stringify({
      host_id: hostId,
      game_type: "buzz_in",
      join_code: joinCode,
      status: "completed",
      settings: {
        question_count: cards.length,
        topic_tags: [tag],
        topic_filter_test: true,
        current_round: cards.length,
      },
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
    }),
  });
  const room = rooms[0];
  assert(room, `Failed to create ${tag} room`);

  await rest(url, key, "game_room_participants", {
    method: "POST",
    body: JSON.stringify({
      room_id: room.id,
      user_id: hostId,
      is_host: true,
      is_playing: true,
    }),
  });

  await rest(url, key, "game_room_rounds", {
    method: "POST",
    body: JSON.stringify(
      cards.map((card, index) => ({
        room_id: room.id,
        round_number: index + 1,
        question_payload: buildPayload(card, cards),
        opened_at: new Date().toISOString(),
        resolved_at: new Date().toISOString(),
        answer_correct: true,
      }))
    ),
  });

  return room.id;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const profiles = await rest<{ id: string }[]>(url, key, "profiles?select=id&limit=1");
  const hostId = profiles[0]?.id;
  assert(hostId, "No profile for test host.");

  const firstPage = await rest<{ topic_tags: string[] }[]>(
    url,
    key,
    "flashcards?select=topic_tags&limit=1000"
  );
  const auxInFirstPage = firstPage.filter((row) =>
    (row.topic_tags ?? []).includes("aux_verb")
  ).length;
  console.log("aux_verb cards in first 1000 rows (old truncated pool):", auxInFirstPage);

  const auxCards = await pickCards(url, key, "aux_verb");
  const weekCards = await pickCards(url, key, "week_6");
  console.log("overlap aux_verb", auxCards.length, "week_6", weekCards.length);

  const auxRoomId = await createTestRoom(url, key, hostId, "aux_verb", auxCards);
  const weekRoomId = await createTestRoom(url, key, hostId, "week_6", weekCards);

  for (const [label, roomId, tag] of [
    ["aux_verb", auxRoomId, "aux_verb"],
    ["week_6", weekRoomId, "week_6"],
  ] as const) {
    const rounds = await rest<RoundRow[]>(
      url,
      key,
      `game_room_rounds?room_id=eq.${roomId}&select=round_number,question_payload&order=round_number.asc`
    );
    const ids = rounds.map((round) => round.question_payload.flashcard_id).join(",");
    const cards = await rest<Card[]>(
      url,
      key,
      `flashcards?id=in.(${ids})&select=id,topic_tags`
    );
    const byId = new Map(cards.map((card) => [card.id, card.topic_tags]));
    const rows = rounds.map((round) => ({
      round_number: round.round_number,
      flashcard_id: round.question_payload.flashcard_id,
      prompt: round.question_payload.prompt,
      topic_tags: byId.get(round.question_payload.flashcard_id) ?? [],
    }));
    const allMatch = rows.every((row) => row.topic_tags.includes(tag));
    console.log(`\nROOM ${roomId} topic=${label} all_match=${allMatch}`);
    console.log(JSON.stringify(rows, null, 2));
    assert(allMatch, `${label} room served a question missing ${tag}`);
  }

  console.log("VERIFY_OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
