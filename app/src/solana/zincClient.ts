import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import {
  ZINC_PROGRAM_ID,
  fetchBoardAccount,
  fetchConfigAccount,
  fetchRoundAccount,
  fetchTreasuryAccount,
  fetchPlayerProfileAccount,
  fetchMaybeAutoMinerSessionAccount,
  getAutoMinerSessionAddress,
  getPlayerProfileAddress,
  getRoundAddress,
  getTreasuryAddress,
  buildInitAutoMinerSessionInstruction,
  buildUpdateAutoMinerSessionInstruction,
  buildTopUpAutoMinerSessionInstruction,
  buildCancelAutoMinerSessionInstruction,
  buildClaimPlayerSolRewardsInstruction,
  buildClaimPlayerZincRewardsInstruction,
  unwrapOption,
} from '@sphalerite-foundry/zinc-ts-sdk/codama-ts-custom';
import type {
  Board,
  Round,
  Config,
  AutoMinerSession,
  PlayerProfile,
} from '@sphalerite-foundry/zinc-ts-sdk/codama-ts';
import { sealTilePattern, validateSealedPattern, type SealedPattern } from './mask';
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
  /** Set when the round account exists but the SDK could not decode it. */
  roundDecodeError: string | null;
  /** Undistributed ZINC Bonanza jackpot held in the treasury's Bonanza vault. */
  bonanzaPot: bigint | null;
};

/** One round-trip read of the live protocol state for the dashboard. */
export async function fetchZincSnapshot(
  connection: Connection,
): Promise<ZincSnapshot> {
  const [board, config, treasury] = await Promise.all([
    fetchBoardAccount(connection),
    fetchConfigAccount(connection),
    fetchTreasuryAccount(connection, getTreasuryAddress()[0]).catch(() => null),
  ]);

  const activeRoundId = opt<bigint>(board.data.activeRoundId);
  const bonanzaPot = treasury ? treasury.data.bonanzaPot : null;

  let activeRound: Round | null = null;
  let roundDecodeError: string | null = null;
  if (activeRoundId != null) {
    try {
      const round = await fetchRoundAccount(connection, getRoundAddress(activeRoundId)[0]);
      activeRound = round.data;
    } catch (e) {
      // The published SDK's Round layout can lag the deployed program; in that
      // case the account still exists, we just can't decode every field. Keep
      // the round id so the UI can still show the live round.
      roundDecodeError = e instanceof Error ? e.message : String(e);
    }
  }

  return {
    board: board.data,
    config: config.data,
    activeRound,
    activeRoundId,
    roundDecodeError,
    bonanzaPot,
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

/** Seals the pattern and aborts if Zinc's crank can't decrypt it (before funds). */
async function sealAndValidate(selectedTiles: number[]): Promise<SealedPattern> {
  const sealed = sealTilePattern(selectedTiles);
  const check = await validateSealedPattern(sealed);
  if (check.reachable && !check.valid) {
    throw new Error(
      "Zinc rejected the sealed tile pattern — the crank can't decrypt it " +
        '(the auto-miner key may have rotated). Aborted before committing funds.',
    );
  }
  return sealed;
}

/** Builds the instruction that creates a new auto-miner session. */
export async function buildStartSessionIx(
  connection: Connection,
  signer: PublicKey,
  params: AutoMinerParams,
): Promise<TransactionInstruction> {
  const sealed = await sealAndValidate(params.selectedTiles);
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
  const sealed = await sealAndValidate(params.selectedTiles);
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

/** Sweeps the player's claimable round SOL rewards to their wallet. */
export function buildClaimSolIx(
  signer: PublicKey,
): Promise<TransactionInstruction> {
  return buildClaimPlayerSolRewardsInstruction({ signer });
}

/** Claims the player's credited round ZINC rewards. */
export function buildClaimZincIx(
  connection: Connection,
  signer: PublicKey,
): Promise<TransactionInstruction> {
  return buildClaimPlayerZincRewardsInstruction({ connection, signer });
}
