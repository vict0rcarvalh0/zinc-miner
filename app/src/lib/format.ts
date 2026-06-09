import { LAMPORTS_PER_SOL } from '../config/zinc';

/** Formats lamports as a trimmed SOL string. */
export function lamportsToSol(lamports: number | bigint, maxFractionDigits = 4): string {
  const value = Number(lamports) / LAMPORTS_PER_SOL;
  return value.toLocaleString(undefined, {
    maximumFractionDigits: maxFractionDigits,
  });
}

/** Parses a SOL string (e.g. "0.05") into integer lamports. */
export function solToLamports(sol: number): bigint {
  return BigInt(Math.round(sol * LAMPORTS_PER_SOL));
}

/** The ZINC SPL mint uses 9 decimals (verified on-chain). */
export const ZINC_DECIMALS = 9;

/** Formats raw ZINC base units as a trimmed whole-token string. */
export function formatZinc(raw: number | bigint, maxFractionDigits = 2): string {
  const value = Number(raw) / 10 ** ZINC_DECIMALS;
  return value.toLocaleString(undefined, { maximumFractionDigits: maxFractionDigits });
}

/** Shortens a base58 address for display. */
export function shortAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

/** Rough seconds-per-round estimate for UX, given Solana's ~0.4s slots. */
export function slotsToApproxMinutes(slots: number | bigint): number {
  return (Number(slots) * 0.4) / 60;
}
