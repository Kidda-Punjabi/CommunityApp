export type TrophyDef = {
  key: string;
  name: string;
  takes: string;
  goal: number;
};

export const TROPHIES: TrophyDef[] = [
  { key: "first_checkin", name: "First check-in", takes: "Check in to one session", goal: 1 },
  { key: "streak_4", name: "4-week streak", takes: "A 4-week main-session streak", goal: 4 },
  { key: "streak_8", name: "8-week streak", takes: "An 8-week main-session streak", goal: 8 },
  { key: "streak_12", name: "12-week streak", takes: "A 12-week main-session streak", goal: 12 },
  { key: "streak_24", name: "24-week streak", takes: "A 24-week main-session streak", goal: 24 },
  { key: "perfect_month", name: "Perfect month", takes: "Every main session in a calendar month", goal: 1 },
  { key: "early_bird", name: "Early bird", takes: "5 on-time check-ins", goal: 5 },
  { key: "bonus_explorer", name: "Bonus explorer", takes: "A bonus-session check-in", goal: 1 },
  { key: "first_room_win", name: "First room win", takes: "Win a breakout room", goal: 1 },
  { key: "room_wins_5", name: "5 room wins", takes: "Win 5 breakout rooms", goal: 5 },
  { key: "room_wins_25", name: "25 room wins", takes: "Win 25 breakout rooms", goal: 25 },
  { key: "speak_it_champion", name: "Speak It champion", takes: "First place in a Speak It race", goal: 1 },
  { key: "full_deck", name: "Full deck", takes: "10 flashcard rounds", goal: 10 },
];
