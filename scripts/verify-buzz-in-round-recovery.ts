/**
 * Live production verification for buzz-in stuck-round recovery.
 *
 * Creates a throwaway buzz_in room, opens 6 rounds, and resolves each via
 * sweep_stuck_buzz_in_rounds() with no client timeout calls (dropped-host case).
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/verify-buzz-in-round-recovery.ts
 */

const QUESTION = {
  flashcard_id: "00000000-0000-0000-0000-000000000001",
  prompt: "recovery-test",
  correct_answer: "haan",
  options: ["haan", "nahin"],
};

type RoundRow = {
  round_number: number;
  opened_at: string | null;
  buzzed_by: string | null;
  buzzed_at: string | null;
  answer_given: string | null;
  answer_correct: boolean | null;
  resolved_at: string | null;
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

async function rest<T>(
  url: string,
  key: string,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...restHeaders(key),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status}): ${text.slice(0, 800)}`);
  }
  return text ? (JSON.parse(text) as T) : (null as T);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const profiles = await rest<{ id: string }[]>(url, key, "profiles?select=id&limit=1");
  const profile = profiles[0];
  assert(profile, "No profile for test host.");

  const joinCode = `ZT${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const rooms = await rest<{ id: string }[]>(url, key, "game_rooms", {
    method: "POST",
    body: JSON.stringify({
      host_id: profile.id,
      game_type: "buzz_in",
      join_code: joinCode,
      status: "in_progress",
      settings: { question_count: 6, current_round: 1, recovery_test: true },
      started_at: new Date().toISOString(),
    }),
  });
  const room = rooms[0];
  assert(room, "Failed to create test room.");
  const roomId = room.id;
  console.log("TEST_ROOM", roomId);

  try {
    await rest(url, key, "game_room_participants", {
      method: "POST",
      body: JSON.stringify({
        room_id: roomId,
        user_id: profile.id,
        is_host: true,
        is_playing: true,
      }),
    });

    const rounds = Array.from({ length: 6 }, (_, index) => ({
      room_id: roomId,
      round_number: index + 1,
      question_payload: QUESTION,
      opened_at: index === 0 ? new Date().toISOString() : null,
    }));
    await rest(url, key, "game_room_rounds", {
      method: "POST",
      body: JSON.stringify(rounds),
    });

    for (let roundNumber = 1; roundNumber <= 6; roundNumber += 1) {
      const currentRows = await rest<{ id: string; resolved_at: string | null }[]>(
        url,
        key,
        `game_room_rounds?room_id=eq.${roomId}&round_number=eq.${roundNumber}&select=id,resolved_at`
      );
      const current = currentRows[0];
      assert(current, `Missing round ${roundNumber}`);
      assert(!current.resolved_at, `Round ${roundNumber} was already resolved`);

      const waitMs = roundNumber % 2 === 1 ? 8_000 : 13_000;
      const droppedHostAt = new Date(Date.now() - waitMs).toISOString();
      if (roundNumber % 2 === 1) {
        await rest(
          url,
          key,
          `game_room_rounds?id=eq.${current.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              buzzed_by: profile.id,
              buzzed_at: droppedHostAt,
            }),
          }
        );
      } else {
        await rest(url, key, `game_room_rounds?id=eq.${current.id}`, {
          method: "PATCH",
          body: JSON.stringify({ opened_at: droppedHostAt }),
        });
      }

      const sweep = await rest(url, key, "rpc/sweep_stuck_buzz_in_rounds", {
        method: "POST",
        body: "{}",
      });
      console.log(`round ${roundNumber} sweep`, sweep);

      const afterRows = await rest<RoundRow[]>(
        url,
        key,
        `game_room_rounds?room_id=eq.${roomId}&round_number=eq.${roundNumber}&select=round_number,opened_at,buzzed_by,buzzed_at,answer_given,answer_correct,resolved_at`
      );
      const after = afterRows[0];
      assert(after?.resolved_at, `Round ${roundNumber} resolved_at was not written`);
      const resolvedLagMs = new Date(after.resolved_at).getTime() - new Date(droppedHostAt).getTime();
      const minLagMs = roundNumber % 2 === 1 ? 7_000 : 12_000;
      assert(resolvedLagMs >= minLagMs, `Round ${roundNumber} resolved too early (${resolvedLagMs}ms)`);
      assert(resolvedLagMs < 30_000, `Round ${roundNumber} resolved too slowly (${resolvedLagMs}ms)`);
      console.log(`round ${roundNumber} resolved_lag_ms=${resolvedLagMs}`);
    }

    const allRounds = await rest<RoundRow[]>(
      url,
      key,
      `game_room_rounds?room_id=eq.${roomId}&select=round_number,opened_at,buzzed_by,buzzed_at,answer_given,answer_correct,resolved_at&order=round_number.asc`
    );
    const finishedRooms = await rest<{ status: string; settings: Record<string, unknown> }[]>(
      url,
      key,
      `game_rooms?id=eq.${roomId}&select=status,settings`
    );
    const finishedRoom = finishedRooms[0];

    console.log("ROOM_STATUS", finishedRoom?.status, finishedRoom?.settings);
    console.log("ROUNDS");
    console.log(JSON.stringify(allRounds, null, 2));

    assert(finishedRoom?.status === "completed", `Expected room completed, got ${finishedRoom?.status}`);
    assert(allRounds.every((row) => row.resolved_at), "Not every round has resolved_at");
    console.log("VERIFY_OK");
    console.log("Left test room in place for independent verification:", roomId);
  } catch (error) {
    console.error("VERIFY_FAILED room", roomId, error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
