import { useCallback, useState } from 'react';
import { getConnection } from '../solana/connection';
import { useMobileWallet } from '../wallet/useMobileWallet';
import {
  buildStartSessionIx,
  buildUpdateSessionIx,
  buildTopUpIx,
  buildCancelIx,
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

  return { start, update, topUp, cancel, busy, lastError };
}
