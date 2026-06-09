import { useCallback, useEffect, useRef, useState } from 'react';
import { getConnection } from '../solana/connection';
import { cachedHistory, syncRoundHistory } from '../lib/roundHistory';
import type { RoundResult } from '../lib/roundAnalytics';

export type RoundHistory = {
  results: RoundResult[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Accumulating round-history feed. Paints instantly from the persisted cache,
 * then on every round flip does a few *cheap* on-chain syncs (now + retries) to
 * catch the just-ended round once its winning square is revealed — the reveal
 * lands a few seconds after the next round becomes active. The manual refresh
 * additionally runs the deeper transaction backfill.
 */
export function useRoundHistory(activeRoundId: bigint | null): RoundHistory {
  const [results, setResults] = useState<RoundResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Instant first paint from disk.
  useEffect(() => {
    cachedHistory()
      .then((r) => setResults((prev) => (prev.length ? prev : r)))
      .catch(() => {});
  }, []);

  const idNum = activeRoundId != null ? Number(activeRoundId) : null;

  const sync = useCallback(
    async (allowTx: boolean) => {
      if (idNum == null) return;
      if (allowTx) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await syncRoundHistory(getConnection(), idNum, {
          want: 500,
          allowTx,
          txBudget: 6,
        });
        setResults(res);
      } catch (e) {
        if (allowTx) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (allowTx) setLoading(false);
      }
    },
    [idNum],
  );

  // On each new round: cheap sync now, then retries to catch the delayed reveal
  // of the round that just ended.
  const lastId = useRef<number | null>(null);
  useEffect(() => {
    if (idNum == null || lastId.current === idNum) return;
    lastId.current = idNum;
    const cheap = () => void sync(false);
    cheap();
    const timers = [4000, 9000, 16000].map((ms) => setTimeout(cheap, ms));
    return () => timers.forEach(clearTimeout);
  }, [idNum, sync]);

  const refresh = useCallback(() => void sync(true), [sync]);

  return { results, loading, error, refresh };
}
