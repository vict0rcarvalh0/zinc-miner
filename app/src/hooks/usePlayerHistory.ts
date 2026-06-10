import { useCallback, useEffect, useState } from 'react';
import { fetchPlayerHistory, type PlayerRound } from '../lib/playerHistory';

export type PlayerHistory = {
  rounds: PlayerRound[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/** The connected player's recent round outcomes (won/lost + payouts). */
export function usePlayerHistory(pubkey: string | null): PlayerHistory {
  const [rounds, setRounds] = useState<PlayerRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!pubkey) {
      setRounds([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRounds(await fetchPlayerHistory(pubkey, 30));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [pubkey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rounds, loading, error, refresh };
}
