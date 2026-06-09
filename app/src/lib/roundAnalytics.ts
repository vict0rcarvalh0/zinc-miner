import { FIRST_NUMBER, LAST_NUMBER, TILE_COUNT } from '../config/zinc';

/** One settled round's outcome. */
export type RoundResult = {
  id: number;
  /** Winning roulette number, 1..30. */
  number: number;
};

export type TileFreq = { n: number; c: number };

export type RoundStats = {
  count: number;
  odd: number;
  even: number;
  oddPct: number;
  evenPct: number;
  /** Streak of the most recent results sharing a parity. */
  currentRun: { parity: 'odd' | 'even'; length: number } | null;
  longestOdd: number;
  longestEven: number;
  /** Frequency per number (index = number, 0 unused). */
  freq: number[];
  hot: TileFreq[];
  cold: TileFreq[];
};

const isOdd = (n: number) => n % 2 === 1;

/**
 * Derive the decision-support stats from a list of results ordered
 * most-recent-first. Pure + cheap so it can run on every render.
 */
export function computeRoundStats(results: RoundResult[]): RoundStats {
  const numbers = results.map((r) => r.number);
  const count = numbers.length;

  let odd = 0;
  const freq = new Array(LAST_NUMBER + 1).fill(0);
  for (const n of numbers) {
    if (n >= FIRST_NUMBER && n <= LAST_NUMBER) freq[n] += 1;
    if (isOdd(n)) odd += 1;
  }
  const even = count - odd;
  const oddPct = count ? Math.round((odd / count) * 100) : 0;
  const evenPct = count ? 100 - oddPct : 0;

  // Current run from the most recent result.
  let currentRun: RoundStats['currentRun'] = null;
  if (count) {
    const parity = isOdd(numbers[0]) ? 'odd' : 'even';
    let length = 0;
    for (const n of numbers) {
      if ((isOdd(n) ? 'odd' : 'even') === parity) length += 1;
      else break;
    }
    currentRun = { parity, length };
  }

  // Longest odd / even streaks anywhere in the window.
  let longestOdd = 0;
  let longestEven = 0;
  let runOdd = 0;
  let runEven = 0;
  for (const n of numbers) {
    if (isOdd(n)) {
      runOdd += 1;
      runEven = 0;
    } else {
      runEven += 1;
      runOdd = 0;
    }
    if (runOdd > longestOdd) longestOdd = runOdd;
    if (runEven > longestEven) longestEven = runEven;
  }

  // Hot = highest frequency; cold = lowest (includes never-seen 0× numbers).
  // Recency breaks ties so a recently-hit number ranks "hotter".
  const lastSeen = new Array(LAST_NUMBER + 1).fill(Infinity);
  numbers.forEach((n, i) => {
    if (lastSeen[n] === Infinity) lastSeen[n] = i;
  });
  const all: TileFreq[] = [];
  for (let n = FIRST_NUMBER; n <= LAST_NUMBER; n++) all.push({ n, c: freq[n] });

  const hot = [...all]
    .sort((a, b) => b.c - a.c || lastSeen[a.n] - lastSeen[b.n] || a.n - b.n)
    .slice(0, 5);
  const cold = [...all]
    .sort((a, b) => a.c - b.c || lastSeen[b.n] - lastSeen[a.n] || a.n - b.n)
    .slice(0, 5);

  return {
    count,
    odd,
    even,
    oddPct,
    evenPct,
    currentRun,
    longestOdd,
    longestEven,
    freq,
    hot,
    cold,
  };
}

export { TILE_COUNT };
