/** Canonical battle scoring for Edge Functions (mirrors src/lib/battle/scoring.ts). */

export function speedBonus(timeToAnswerSeconds: number): number {
  return Math.max(0, 5 - timeToAnswerSeconds);
}

export function damageValue(correct: boolean, timeToAnswerSeconds: number): number {
  if (!correct) return 0;
  return 10 + speedBonus(timeToAnswerSeconds);
}

export function roundMultiplier(roundNumber: number): number {
  if (roundNumber >= 9) return 3.0;
  const table: Record<number, number> = {
    1: 1.0,
    2: 1.1,
    3: 1.2,
    4: 1.3,
    5: 1.4,
    6: 1.5,
    7: 2.0,
    8: 2.5,
  };
  return table[roundNumber] ?? 3.0;
}

export function secondsBetween(startIso: string, endIso: string): number {
  return Math.max(0, (new Date(endIso).getTime() - new Date(startIso).getTime()) / 1000);
}

export type PlayerRoundInput = {
  correct: boolean;
  answeredAtIso: string | null;
};

export function resolveRoundDamage(
  roundNumber: number,
  roundStartedAtIso: string,
  playerOne: PlayerRoundInput,
  playerTwo: PlayerRoundInput
) {
  const p1Seconds =
    playerOne.correct && playerOne.answeredAtIso
      ? secondsBetween(roundStartedAtIso, playerOne.answeredAtIso)
      : 0;
  const p2Seconds =
    playerTwo.correct && playerTwo.answeredAtIso
      ? secondsBetween(roundStartedAtIso, playerTwo.answeredAtIso)
      : 0;

  const p1Raw = damageValue(playerOne.correct, p1Seconds);
  const p2Raw = damageValue(playerTwo.correct, p2Seconds);

  let netDamage = 0;
  let recipient: "player_one" | "player_two" | null = null;

  if (playerOne.correct && !playerTwo.correct) {
    netDamage = p1Raw;
    recipient = "player_two";
  } else if (playerTwo.correct && !playerOne.correct) {
    netDamage = p2Raw;
    recipient = "player_one";
  } else if (playerOne.correct && playerTwo.correct) {
    if (p1Raw > p2Raw) {
      netDamage = p1Raw - p2Raw;
      recipient = "player_two";
    } else if (p2Raw > p1Raw) {
      netDamage = p2Raw - p1Raw;
      recipient = "player_one";
    }
  }

  const multiplier = roundMultiplier(roundNumber);
  const finalDamage = Math.round(netDamage * multiplier);

  return {
    playerOneDamageDealt: recipient === "player_two" ? finalDamage : 0,
    playerTwoDamageDealt: recipient === "player_one" ? finalDamage : 0,
    finalDamage,
    damageRecipient: recipient,
  };
}
