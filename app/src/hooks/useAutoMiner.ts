import { useCallback, useState } from 'react';
import type { TransactionInstruction } from '@solana/web3.js';
import { getConnection } from '../solana/connection';
import { useMobileWallet } from '../wallet/useMobileWallet';
import {
  buildStartSessionIx,
  buildUpdateSessionIx,
  buildTopUpIx,
  buildCancelIx,
  buildClaimSolIx,
  buildClaimZincIx,
  type AutoMinerParams,
} from '../solana/zincClient';

export type UpdateParams = Omit<AutoMinerParams, 'initialBudget'> & {
  paused: boolean;
};

/** Imperative auto-miner actions, each returning the confirmed signature. */
export function useAutoMiner(onChanged?: () => void) {
  const { sendInstructions } = useMobileWallet();
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<string>): Promise<string | null> => {
      setBusy(true);
      setLastError(null);
      try {
        const sig = await action();
        onChanged?.();
        return sig;
      } catch (e) {
        setLastError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [onChanged],
  );

  const start = useCallback(
    (params: AutoMinerParams) =>
      run(() =>
        sendInstructions((payer) =>
          buildStartSessionIx(getConnection(), payer, params).then((ix) => [ix]),
        ),
      ),
    [run, sendInstructions],
  );

  const update = useCallback(
    (params: UpdateParams) =>
      run(() =>
        sendInstructions((payer) =>
          buildUpdateSessionIx(getConnection(), payer, params).then((ix) => [
            ix,
          ]),
        ),
      ),
    [run, sendInstructions],
  );

  const topUp = useCallback(
    (amount: bigint) =>
      run(() =>
        sendInstructions((payer) => buildTopUpIx(payer, amount).then((ix) => [ix])),
      ),
    [run, sendInstructions],
  );

  const cancel = useCallback(
    () =>
      run(() =>
        sendInstructions((payer) => buildCancelIx(payer).then((ix) => [ix])),
      ),
    [run, sendInstructions],
  );

  const claimSol = useCallback(
    () =>
      run(() =>
        sendInstructions((payer) => buildClaimSolIx(payer).then((ix) => [ix])),
      ),
    [run, sendInstructions],
  );

  const claimZinc = useCallback(
    () =>
      run(() =>
        sendInstructions((payer) =>
          buildClaimZincIx(getConnection(), payer).then((ix) => [ix]),
        ),
      ),
    [run, sendInstructions],
  );

  // Claim SOL and/or smelt ZINC in a single transaction.
  const claimAll = useCallback(
    (opts: { sol: boolean; zinc: boolean }) =>
      run(() =>
        sendInstructions(async (payer) => {
          const ixs: TransactionInstruction[] = [];
          if (opts.sol) ixs.push(await buildClaimSolIx(payer));
          if (opts.zinc) ixs.push(await buildClaimZincIx(getConnection(), payer));
          return ixs;
        }),
      ),
    [run, sendInstructions],
  );

  return { start, update, topUp, cancel, claimSol, claimZinc, claimAll, busy, lastError };
}
