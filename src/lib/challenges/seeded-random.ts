/** Deterministic PRNG (mulberry32) for fair head-to-head question order. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleSeeded<T>(items: T[], seed: number): T[] {
  const random = createSeededRandom(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickCycledPoolSeeded<T>(pool: T[], count: number, seed: number): T[] {
  if (pool.length === 0 || count <= 0) return [];

  const result: T[] = [];
  let passSeed = seed;
  let index = 0;
  let shuffled = shuffleSeeded(pool, passSeed);

  while (result.length < count) {
    if (index >= shuffled.length) {
      passSeed += 1;
      shuffled = shuffleSeeded(pool, passSeed);
      index = 0;
    }
    result.push(shuffled[index]);
    index += 1;
  }

  return result;
}
