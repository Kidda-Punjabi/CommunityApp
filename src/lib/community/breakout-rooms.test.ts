import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planBreakoutRooms, suggestLateRoom, type RoomPerson } from "./breakout-rooms";

function person(userId: string, level: number, podId: string | null = null): RoomPerson {
  return { userId, level, podId };
}

describe("planBreakoutRooms", () => {
  it("gives one person their own room", () => {
    const rooms = planBreakoutRooms([person("a", 2)]);
    assert.deepEqual(rooms, [{ roomNumber: 1, band: "beginner", userIds: ["a"] }]);
  });

  it("keeps three beginners together", () => {
    const rooms = planBreakoutRooms([person("c", 1), person("a", 3), person("b", 2)]);
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].band, "beginner");
    assert.deepEqual(rooms[0].userIds, ["a", "b", "c"]);
  });

  it("splits nine beginners into rooms of five and four", () => {
    const rooms = planBreakoutRooms(
      Array.from({ length: 9 }, (_, index) => person(String(index + 1).padStart(2, "0"), 2))
    );
    assert.deepEqual(
      rooms.map((room) => room.userIds.length),
      [5, 4]
    );
    assert.ok(rooms.every((room) => room.band === "beginner"));
  });

  it("merges a lone advanced member into the nearest room", () => {
    const rooms = planBreakoutRooms([
      person("b1", 4),
      person("b2", 5),
      person("b3", 6),
      person("adv", 8),
    ]);
    assert.equal(rooms.length, 1);
    assert.equal(rooms[0].band, "intermediate");
    assert.deepEqual(rooms[0].userIds, ["adv", "b1", "b2", "b3"]);
  });

  it("keeps pod-mates in the same room when the band splits", () => {
    const rooms = planBreakoutRooms([
      ...Array.from({ length: 5 }, (_, index) => person(`p${index}`, 2, "pod")),
      ...Array.from({ length: 4 }, (_, index) => person(`s${index}`, 2, null)),
    ]);
    const podRoom = rooms.find((room) => room.userIds.some((id) => id.startsWith("p")));
    assert.ok(podRoom);
    assert.equal(podRoom.userIds.filter((id) => id.startsWith("p")).length, 5);
  });
});

describe("suggestLateRoom", () => {
  it("puts a late beginner into the beginner room with space", () => {
    const choice = suggestLateRoom(person("late", 2), [
      { roomNumber: 1, band: "beginner", count: 4 },
      { roomNumber: 2, band: "advanced", count: 2 },
    ]);
    assert.deepEqual(choice, { roomNumber: 1 });
  });

  it("uses the nearest band when their own band is full", () => {
    const choice = suggestLateRoom(person("late", 5), [
      { roomNumber: 1, band: "beginner", count: 4 },
      { roomNumber: 2, band: "advanced", count: 8 },
    ]);
    assert.deepEqual(choice, { roomNumber: 1 });
  });
});
