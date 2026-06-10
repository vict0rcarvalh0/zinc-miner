import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicKey } from '@solana/web3.js';
import type {
  AutoMinerSession,
  PlayerProfile,
} from '@sphalerite-foundry/zinc-ts-sdk/codama-ts';
import { getConnection } from '../solana/connection';
import {
  fetchZincSnapshot,
  fetchSession,
  fetchProfile,
  type ZincSnapshot,
} from '../solana/zincClient';

const POLL_INTERVAL_MS = 15_000;

export type ZincState = {
  account: PublicKey | null;
  snapshot: ZincSnapshot | null;
  session: AutoMinerSession | null;
  profile: PlayerProfile | null;
  balanceLamports: number | null;
  slot: number | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/** Polls live protocol + wallet state on an interval; refreshes on demand. */
export function useZincState(account: PublicKey | null): ZincState {
  const [snapshot, setSnapshot] = useState<ZincSnapshot | null>(null);
  const [session, setSession] = useState<AutoMinerSession | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [balanceLamports, setBalance] = useState<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest account in a ref so the interval callback stays stable.
  const accountRef = useRef<PublicKey | null>(account);
  accountRef.current = account;

  const refresh = useCallback(async () => {
    const connection = getConnection();
    const current = accountRef.current;
    setLoading(true);
    setError(null);
    try {
      const [snap, currentSlot] = await Promise.all([
        fetchZincSnapshot(connection),
        connection.getSlot('confirmed'),
      ]);
      setSnapshot(snap);
      setSlot(currentSlot);

      if (current) {
        const [sess, prof, bal] = await Promise.all([
          fetchSession(connection, current),
          fetchProfile(connection, current),
          connection.getBalance(current, 'confirmed'),
        ]);
        setSession(sess);
        setProfile(prof);
        setBalance(bal);
      } else {
        setSession(null);
        setProfile(null);
        setBalance(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh, account]);

  return {
    account,
    snapshot,
    session,
    profile,
    balanceLamports,
    slot,
    loading,
    error,
    refresh,
  };
}
