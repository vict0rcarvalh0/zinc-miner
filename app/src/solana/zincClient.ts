import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  ZINC_PROGRAM_ID,
  fetchBoardAccount,
  fetchConfigAccount,
  fetchRoundAccount,
  fetchPlayerProfileAccount,
  fetchMaybeAutoMinerSessionAccount,
  getAutoMinerSessionAddress,
  getPlayerProfileAddress,
  getRoundAddress,
  buildInitAutoMinerSessionInstruction,
  buildUpdateAutoMinerSessionInstruction,
  buildTopUpAutoMinerSessionInstruction,
  buildCancelAutoMinerSessionInstruction,
  unwrapOption,
} from '@sphalerite-foundry/zinc-ts-sdk/codama-ts-custom';
import type {
  Board,
  Round,
  Config,
  AutoMinerSession,
  PlayerProfile,
} from '@sphalerite-foundry/zinc-ts-sdk/codama-ts';
import { sealTilePattern } from './mask';
import { ZINC_EXECUTOR } from '../config/zinc';

export { ZINC_PROGRAM_ID } from '@sphalerite-foundry/zinc-ts-sdk/codama-ts-custom';

/** Unwraps the SDK's `Option<T>` to a value or `null` (vs the SDK's `undefined`). */
export function opt<T>(option: unknown): T | null {
  // Delegates to the SDK's `isSome`-based unwrap for representation parity.
  const value = unwrapOption(option as Parameters<typeof unwrapOption>[0]);
  return (value ?? null) as T | null;
}

export type ZincSnapshot = {
  board: Board;
  config: Config;
  activeRound: Round | null;
  activeRoundId: bigint | null;
};

/** One round-trip read of the live protocol state for the dashboard. */
export async function fetchZincSnapshot(
  connection: Connection,
): Promise<ZincSnapshot> {
  const [board, config] = await Promise.all([
    fetchBoardAccount(connection),
    fetchConfigAccount(connection),
  ]);

  const activeRoundId = opt<bigint>(board.data.activeRoundId);
  let activeRound: Round | null = null;
  if (activeRoundId != null) {
    try {
      const round = await fetchRoundAccount(
        connection,
        getRoundAddress(activeRoundId)[0],
      );
      activeRound = round.data;
    } catch {
      activeRound = null;
    }
  }

  return {
    board: board.data,
    config: config.data,
    activeRound,
    activeRoundId,
  };
}

/** Reads the caller's auto-miner session, or null if none exists. */
export async function fetchSession(
  connection: Connection,
  authority: PublicKey,
): Promise<AutoMinerSession | null> {
  const [address] = getAutoMinerSessionAddress(authority);
  const account = await fetchMaybeAutoMinerSessionAccount(connection, address);
  return account?.data ?? null;
}

/** Reads the caller's player profile (claimable rewards, streaks), or null. */
export async function fetchProfile(
  connection: Connection,
  authority: PublicKey,
): Promise<PlayerProfile | null> {
  try {
    const profile = await fetchPlayerProfileAccount(
      connection,
      getPlayerProfileAddress(authority)[0],
    );
    return profile.data;
  } catch {
    return null;
  }
}

export type AutoMinerParams = {
  /** Tiles the auto-miner will deploy onto every round. */
  selectedTiles: number[];
  /** Gross lamports deployed into each eligible round. */
  amountPerRound: bigint;
  /** Initial user-funded budget (lamports) — bounds how many rounds run. */
  initialBudget: bigint;
  /** Optional last slot the session may deploy at. */
  expirySlot?: bigint | null;
  /** Reload credited SOL rewards back into the budget. */
  autoReloadSolRewards: boolean;
  /** Fixed crank reimbursement per successful deploy (lamports). */
  crankReimbursementLamports: bigint;
};

/** Builds the instruction that creates a new auto-miner session. */
export async function buildStartSessionIx(
  connection: Connection,
  signer: PublicKey,
  params: AutoMinerParams,
): Promise<TransactionInstruction> {
  const sealed = await sealTilePattern(
    connection,
    ZINC_PROGRAM_ID,
    params.selectedTiles,
  );
  return buildInitAutoMinerSessionInstruction({
    signer,
    executor: ZINC_EXECUTOR,
    amountPerRound: params.amountPerRound,
    initialBudget: params.initialBudget,
    expirySlot: params.expirySlot ?? null,
    autoReloadSolRewards: params.autoReloadSolRewards,
    crankReimbursementLamports: params.crankReimbursementLamports,
    maskBitsEncryptionKey: sealed.maskBitsEncryptionKey,
    maskBitsNonce: sealed.maskBitsNonce,
    maskBitsCiphertext: sealed.maskBitsCiphertext,
    maskBitsKeyVersion: sealed.maskBitsKeyVersion,
  });
}

/** Builds the instruction that updates an existing session (params/pause). */
export async function buildUpdateSessionIx(
  connection: Connection,
  signer: PublicKey,
  params: Omit<AutoMinerParams, 'initialBudget'> & { paused: boolean },
): Promise<TransactionInstruction> {
  const sealed = await sealTilePattern(
    connection,
    ZINC_PROGRAM_ID,
    params.selectedTiles,
  );
  return buildUpdateAutoMinerSessionInstruction({
    signer,
    executor: ZINC_EXECUTOR,
    amountPerRound: params.amountPerRound,
    expirySlot: params.expirySlot ?? null,
    paused: params.paused,
    autoReloadSolRewards: params.autoReloadSolRewards,
    crankReimbursementLamports: params.crankReimbursementLamports,
    maskBitsEncryptionKey: sealed.maskBitsEncryptionKey,
    maskBitsNonce: sealed.maskBitsNonce,
    maskBitsCiphertext: sealed.maskBitsCiphertext,
    maskBitsKeyVersion: sealed.maskBitsKeyVersion,
  });
}

/** Builds the instruction that tops up an existing session's budget. */
export function buildTopUpIx(
  signer: PublicKey,
  amount: bigint,
): Promise<TransactionInstruction> {
  return buildTopUpAutoMinerSessionInstruction({ signer, amount });
}

/** Builds the instruction that cancels and refunds a session. */
export function buildCancelIx(
  signer: PublicKey,
): Promise<TransactionInstruction> {
  return buildCancelAutoMinerSessionInstruction({ signer });
}
