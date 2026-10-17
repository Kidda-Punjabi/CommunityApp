export const CHECKIN_NOT_LIVE = "Check-in opens when the session is live";
export const CHECKIN_BAD_CODE = "That code isn't for a live session. Check the code on screen";
export const CHECKIN_TOO_MANY = "Too many tries. Wait a few minutes and try the code again.";

export type CheckInMate = {
  id: string;
  name: string;
  level: number | null;
};

export type CheckInSuccess = {
  ok: true;
  already: boolean;
  sessionName: string;
  countsForStreak: boolean;
  streak: number;
  meetUrl: string | null;
  others: CheckInMate[];
  xpAwarded: number;
};

export type CheckInResponse = { error: string } | CheckInSuccess;
