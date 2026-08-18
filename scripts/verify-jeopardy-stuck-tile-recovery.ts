/**
 * Live production verification for Jeopardy stuck-tile recovery.
 *
 * Backdates an active tile (buzzed, no answer) and confirms
 * sweep_stuck_jeopardy_tiles() resolves it without any client timeout.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/verify-jeopardy-stuck-tile-recovery.ts
 */

type TileRow = {
  id: string;
  category: string;
  point_value: number;
  status: string;
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

const QUESTION = {
  flashcard_id: "00000000-0000-0000-0000-000000000001",
  prompt: "jeopardy-recovery-test",
  correct_answer: "haan",
  options: ["haan", "nahin"],
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const profiles = await rest<{ id: string }[]>(url, key, "profiles?select=id&limit=1");
  const profile = profiles[0];
  assert(profile, "No profile for test host.");

  const joinCode = `JT${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const rooms = await rest<{ id: string }[]>(url, key, "game_rooms", {
    method: "POST",
    body: JSON.stringify({
      host_id: profile.id,
      game_type: "jeopardy",
      join_code: joinCode,
      status: "in_progress",
      current_picker_id: profile.id,
      settings: { recovery_test: true },
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

    const tiles = await rest<TileRow[]>(url, key, "game_room_jeopardy_tiles", {
      method: "POST",
      body: JSON.stringify([
        {
          room_id: roomId,
          category: "vocab",
          point_value: 100,
          question_payload: QUESTION,
          status: "resolved",
          opened_at: new Date(Date.now() - 60_000).toISOString(),
          resolved_at: new Date(Date.now() - 50_000).toISOString(),
          answer_correct: true,
        },
        {
          room_id: roomId,
          category: "vocab",
          point_value: 200,
          question_payload: QUESTION,
          status: "active",
          opened_at: new Date().toISOString(),
        },
        {
          room_id: roomId,
          category: "vocab",
          point_value: 300,
          question_payload: QUESTION,
          status: "unopened",
        },
      ]),
    });
    assert(tiles.length === 3, `Expected 3 tiles, got ${tiles.length}`);
    const stuck = tiles.find((t) => t.point_value === 200);
    assert(stuck, "Missing active tile");

    const droppedHostAt = new Date(Date.now() - 8_000).toISOString();
    await rest(url, key, `game_room_jeopardy_tiles?id=eq.${stuck.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        buzzed_by: profile.id,
        buzzed_at: droppedHostAt,
      }),
    });
    console.log("Tile 200 buzzed with no answer; simulating dropped clients.");

    const sweep = await rest(url, key, "rpc/sweep_stuck_jeopardy_tiles", {
      method: "POST",
      body: "{}",
    });
    console.log("sweep", sweep);

    const after = await rest<TileRow[]>(
      url,
      key,
      `game_room_jeopardy_tiles?room_id=eq.${roomId}&select=id,category,point_value,status,opened_at,buzzed_by,buzzed_at,answer_given,answer_correct,resolved_at&order=point_value.asc`
    );
    const recovered = after.find((t) => t.point_value === 200);
    assert(recovered?.resolved_at, "Active buzzed tile was not recovered by the sweep");
    assert(recovered.status === "resolved", `Expected resolved status, got ${recovered.status}`);
    const lagMs = new Date(recovered.resolved_at).getTime() - new Date(droppedHostAt).getTime();
    assert(lagMs >= 7_000, `Resolved too early (${lagMs}ms)`);
    assert(lagMs < 30_000, `Resolved too slowly (${lagMs}ms)`);
    console.log(`tile 200 resolved_lag_ms=${lagMs}`);

    const stillUnopened = after.find((t) => t.point_value === 300);
    assert(stillUnopened?.status === "unopened", "Sweep must not touch unopened tiles");

    const roomAfter = await rest<{ status: string }[]>(
      url,
      key,
      `game_rooms?id=eq.${roomId}&select=status`
    );
    assert(roomAfter[0]?.status === "in_progress", "Room should still be in progress");

    console.log("TILES");
    console.log(JSON.stringify(after, null, 2));
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
