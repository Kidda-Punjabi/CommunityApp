import type { CommunityBand } from "@/lib/community/constants";
import { bandForLevel } from "@/lib/community/levels";

export type RoomPerson = {
  userId: string;
  level: number;
  podId: string | null;
};

export type SuggestedRoom = {
  roomNumber: number;
  band: CommunityBand;
  userIds: string[];
};

export type OpenRoom = {
  roomNumber: number;
  band: CommunityBand;
  count: number;
};

const BANDS: CommunityBand[] = ["sounds", "beginner", "intermediate", "advanced"];

function comparePeople(a: RoomPerson, b: RoomPerson): number {
  const pod = (a.podId ?? "").localeCompare(b.podId ?? "");
  if (pod !== 0) return pod;
  return a.userId.localeCompare(b.userId);
}

/** Room sizes of 4 to 5 where we can, never above 8. Six or seven stay together. */
export function chunkSizes(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 7) return [count];
  if (count === 8) return [4, 4];
  const sizes: number[] = [];
  let left = count;
  while (left > 0) {
    if (left <= 7) {
      sizes.push(left);
      break;
    }
    if (left === 8) {
      sizes.push(4, 4);
      break;
    }
    if (left - 5 >= 4) {
      sizes.push(5);
      left -= 5;
    } else {
      sizes.push(4);
      left -= 4;
    }
  }
  return sizes;
}

function packBand(people: RoomPerson[]): RoomPerson[][] {
  const sizes = chunkSizes(people.length);
  const groups = new Map<string, RoomPerson[]>();
  for (const person of [...people].sort(comparePeople)) {
    const key = person.podId ?? `solo:${person.userId}`;
    const list = groups.get(key) ?? [];
    list.push(person);
    groups.set(key, list);
  }
  const pods = [...groups.values()].sort(
    (a, b) => b.length - a.length || a[0].userId.localeCompare(b[0].userId)
  );
  const rooms = sizes.map(() => [] as RoomPerson[]);
  for (const pod of pods) {
    let index = rooms.findIndex((room, i) => sizes[i] - room.length >= pod.length);
    if (index < 0) {
      index = rooms.reduce(
        (best, room, i) => (sizes[i] - room.length > sizes[best] - rooms[best].length ? i : best),
        0
      );
    }
    rooms[index].push(...pod);
  }
  return rooms.filter((room) => room.length > 0);
}

function nearestBand(band: CommunityBand, choices: CommunityBand[]): CommunityBand | null {
  const index = BANDS.indexOf(band);
  let best: CommunityBand | null = null;
  let bestDistance = 99;
  for (const choice of choices) {
    if (choice === band) continue;
    const distance = Math.abs(BANDS.indexOf(choice) - index);
    const better =
      distance < bestDistance ||
      (distance === bestDistance && best != null && BANDS.indexOf(choice) < BANDS.indexOf(best));
    if (best == null || better) {
      best = choice;
      bestDistance = distance;
    }
  }
  return best;
}

export function planBreakoutRooms(members: RoomPerson[]): SuggestedRoom[] {
  const buckets = new Map<CommunityBand, RoomPerson[]>();
  for (const band of BANDS) buckets.set(band, []);
  for (const member of members) {
    const band = bandForLevel(member.level);
    buckets.get(band)?.push(member);
  }

  const present = BANDS.filter((band) => (buckets.get(band)?.length ?? 0) > 0);
  const anchors = present.filter((band) => (buckets.get(band)?.length ?? 0) >= 3);
  const small = present.filter((band) => (buckets.get(band)?.length ?? 0) <= 2);

  for (const band of small) {
    const target = nearestBand(band, anchors.length > 0 ? anchors : present.filter((item) => item !== band));
    if (!target) continue;
    buckets.get(target)?.push(...(buckets.get(band) ?? []));
    buckets.set(band, []);
  }

  const rooms: SuggestedRoom[] = [];
  for (const band of BANDS) {
    for (const group of packBand(buckets.get(band) ?? [])) {
      rooms.push({
        roomNumber: rooms.length + 1,
        band,
        userIds: group.map((person) => person.userId).sort(),
      });
    }
  }
  return rooms;
}

export function suggestLateRoom(
  person: RoomPerson,
  rooms: OpenRoom[]
): { roomNumber: number } | { create: true; band: CommunityBand } {
  const band = bandForLevel(person.level);
  const open = rooms.filter((room) => room.count < 8);
  const pick = (list: OpenRoom[]) =>
    [...list].sort((a, b) => a.count - b.count || a.roomNumber - b.roomNumber)[0];
  const same = pick(open.filter((room) => room.band === band));
  if (same) return { roomNumber: same.roomNumber };
  const nearestName = nearestBand(band, [...new Set(open.map((room) => room.band))]);
  const nearest = nearestName ? pick(open.filter((room) => room.band === nearestName)) : undefined;
  if (nearest) return { roomNumber: nearest.roomNumber };
  return { create: true, band };
}
