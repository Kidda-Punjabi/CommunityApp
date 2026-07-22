/**
 * Simulated "Ask the Audience" distribution — correct option always wins,
 * uneven splits on the rest (for tests / reference; production uses SQL RPC).
 */
export function simulateAudienceVoteTally(
  options: string[],
  correctAnswer: string
): Record<string, number> {
  const correct = correctAnswer.trim();
  const wrong = options.filter((o) => o.trim() !== correct);
  if (wrong.length === 0) {
    return { [correct]: 100 };
  }

  let correctPct = 50 + Math.floor(Math.random() * 36);
  let pool = 100 - correctPct - wrong.length;
  if (pool < 0) {
    correctPct = Math.max(1, 100 - wrong.length - 1);
    pool = 100 - correctPct - wrong.length;
  }

  const wrongPcts: number[] = [];
  let remainingPool = pool;

  for (let i = 0; i < wrong.length; i += 1) {
    if (i === wrong.length - 1) {
      wrongPcts.push(1 + remainingPool);
    } else {
      const slotsLeft = wrong.length - i;
      const maxShare = remainingPool - (slotsLeft - 1);
      const share = Math.floor(Math.random() * (maxShare + 1));
      wrongPcts.push(1 + share);
      remainingPool -= share;
    }
  }

  const tally: Record<string, number> = { [correct]: correctPct };
  wrong.forEach((opt, i) => {
    tally[opt] = wrongPcts[i]!;
  });
  return tally;
}
