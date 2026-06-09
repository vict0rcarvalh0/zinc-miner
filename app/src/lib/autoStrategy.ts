import {
  FIRST_NUMBER,
  LAST_NUMBER,
  TILE_COUNT,
  numberToTile,
  tileToNumber,
} from '../config/zinc';
import type { RoundResult, RoundStats } from './roundAnalytics';

const NUMBERS = Array.from({ length: TILE_COUNT }, (_, i) => i + FIRST_NUMBER);

/** Numbers ranked hottest→coldest (frequency desc, ties by number). */
export function rankedByHeat(stats: RoundStats): number[] {
  return [...NUMBERS].sort((a, b) => stats.freq[b] - stats.freq[a] || a - b);
}

export type StrategyId = 'hot' | 'cold' | 'odd' | 'even' | 'spread' | 'random';

/** Build a tile selection (0-based indices) for a named strategy. */
export function strategyTiles(
  id: StrategyId,
  stats: RoundStats,
  count: number,
): number[] {
  const k = Math.max(1, Math.min(TILE_COUNT, count));
  switch (id) {
    case 'odd':
      return NUMBERS.filter((n) => n % 2 === 1).map(numberToTile);
    case 'even':
      return NUMBERS.filter((n) => n % 2 === 0).map(numberToTile);
    case 'hot':
      return rankedByHeat(stats).slice(0, k).map(numberToTile);
    case 'cold':
      return rankedByHeat(stats).reverse().slice(0, k).map(numberToTile);
    case 'spread': {
      // k numbers spaced as evenly as possible across the wheel.
      const out: number[] = [];
      for (let i = 0; i < k; i++) {
        const n = Math.round(FIRST_NUMBER + (i * (TILE_COUNT - 1)) / (k - 1 || 1));
        out.push(numberToTile(n));
      }
      return [...new Set(out)];
    }
    case 'random': {
      const pool = [...NUMBERS];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, k).map(numberToTile);
    }
  }
}

export type Coverage = {
  k: number;
  coveragePct: number;
  hits: number;
  n: number;
  /** Observed hit rate of this selection over history. */
  hitRate: number;
  /** Theoretical hit rate = k / 30 (each round is independent). */
  expectedRate: number;
};

/** How much of the board a selection covers, and how often it would have hit. */
export function coverage(selected: Set<number>, results: RoundResult[]): Coverage {
  const k = selected.size;
  const nums = new Set([...selected].map(tileToNumber));
  let hits = 0;
  for (const r of results) if (nums.has(r.number)) hits += 1;
  const n = results.length;
  return {
    k,
    coveragePct: Math.round((k / TILE_COUNT) * 100),
    hits,
    n,
    hitRate: n ? hits / n : 0,
    expectedRate: k / TILE_COUNT,
  };
}

export type Sizing = {
  amountPerRound: bigint;
  perRoundCost: bigint;
  budget: bigint;
  feasibleRounds: number;
};

/** Suggest an amount-per-round from a % of bankroll spread over a target run. */
export function suggestSizing(input: {
  balanceLamports: bigint;
  riskPct: number;
  targetRounds: number;
  crankFee: bigint;
  minDeploy: bigint;
}): Sizing {
  const { balanceLamports, riskPct, targetRounds, crankFee, minDeploy } = input;
  const budget = (balanceLamports * BigInt(Math.round(riskPct))) / 100n;
  const target = BigInt(Math.max(1, targetRounds));
  const perRoundBudget = budget / target;
  let amountPerRound = perRoundBudget > crankFee ? perRoundBudget - crankFee : 0n;
  if (amountPerRound < minDeploy) amountPerRound = minDeploy;
  const perRoundCost = amountPerRound + crankFee;
  const feasibleRounds = perRoundCost > 0n ? Number(budget / perRoundCost) : 0;
  return { amountPerRound, perRoundCost, budget, feasibleRounds };
}

export type RiskLevel = 'low' | 'medium' | 'high';

/** Share of wallet committed to the session, bucketed. */
export function riskLevel(budget: bigint, balance: bigint | null): {
  pct: number;
  level: RiskLevel;
} {
  if (balance == null || balance <= 0n) return { pct: 0, level: 'low' };
  const pct = Number((budget * 1000n) / balance) / 10; // one decimal
  const level: RiskLevel = pct < 25 ? 'low' : pct < 60 ? 'medium' : 'high';
  return { pct, level };
}

export type Ev = {
  hitProb: number;
  estPayoutIfHit: number; // lamports
  evPerRound: number; // lamports (can be negative)
  payoutMultiple: number; // payout / round cost
};

/**
 * Rough expected-value estimate from the live round. Models a uniform stake
 * distribution (pot / 30 per tile) — a transparent approximation, NOT a payout
 * guarantee. Each round is independent, so this is decision support, not edge.
 */
export function estimateEv(input: {
  potLamports: bigint;
  amountPerRound: bigint;
  selectedCount: number;
  crankFee: bigint;
}): Ev {
  const pot = Number(input.potLamports);
  const k = input.selectedCount;
  const amount = Number(input.amountPerRound);
  const yourPerTile = k > 0 ? amount / k : 0; // uniform split across your tiles
  const avgTile = pot / TILE_COUNT; // assumed total already on a tile
  const totalOnTile = avgTile + yourPerTile;
  const estPayoutIfHit = totalOnTile > 0 ? (yourPerTile / totalOnTile) * (pot + yourPerTile) : 0;
  const hitProb = k / TILE_COUNT;
  const cost = amount + Number(input.crankFee);
  return {
    hitProb,
    estPayoutIfHit,
    evPerRound: hitProb * estPayoutIfHit - cost,
    payoutMultiple: cost > 0 ? estPayoutIfHit / cost : 0,
  };
}

export type Backtest = {
  hits: number;
  n: number;
  hitRate: number;
  netLamports: number; // estimated
};

/** Replay a selection over stored results; P/L uses the live EV payout as a proxy. */
export function backtest(
  selected: Set<number>,
  results: RoundResult[],
  amountPerRound: bigint,
  crankFee: bigint,
  estPayoutIfHit: number,
): Backtest {
  const nums = new Set([...selected].map(tileToNumber));
  let hits = 0;
  for (const r of results) if (nums.has(r.number)) hits += 1;
  const n = results.length;
  const cost = Number(amountPerRound + crankFee) * n;
  const gross = hits * estPayoutIfHit;
  return { hits, n, hitRate: n ? hits / n : 0, netLamports: gross - cost };
}
