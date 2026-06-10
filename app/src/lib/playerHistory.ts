import { ZINC_API_BASE } from '../config/zinc';

/** One settled/pending round the player participated in, with outcome + payout. */
export type PlayerRound = {
  roundId: number;
  /** Winning roulette number (1..30), or null if not revealed yet. */
  winningNumber: number | null;
  isSettled: boolean;
  isWinner: boolean;
  /** Net lamports the player had in this round. */
  betLamports: number;
  /** SOL payout for this round, lamports. */
  payoutLamports: number;
  /** ZINC payout for this round, raw base units (9 decimals). */
  zincPayout: number;
  isClaimable: boolean;
  solClaimed: boolean;
};

type RawItem = {
  round?: { id?: number; winning_square?: number | null };
  total_amount?: number | string;
  payout_amount?: number | string;
  zinc_payout_amount?: number | string;
  is_settled?: boolean;
  is_winner?: boolean;
  is_claimable?: boolean;
  sol_claimed?: boolean;
};

/**
 * The player's recent rounds with outcomes, from Zinc's read API
 * (`GET /api/player/{pubkey}/history`). Newest first.
 */
export async function fetchPlayerHistory(
  pubkey: string,
  pageSize = 30,
): Promise<PlayerRound[]> {
  const url = `${ZINC_API_BASE}/player/${encodeURIComponent(pubkey)}/history?pageSize=${pageSize}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Failed to fetch player history (${res.status})`);
  const json = (await res.json()) as { items?: RawItem[] } | null;
  const items = Array.isArray(json?.items) ? json!.items! : [];
  return items.map((it): PlayerRound => {
    const ws = it.round?.winning_square;
    return {
      roundId: Number(it.round?.id ?? 0),
      winningNumber: ws == null ? null : Number(ws) + 1,
      isSettled: it.is_settled === true,
      isWinner: it.is_winner === true,
      betLamports: Number(it.total_amount ?? 0),
      payoutLamports: Number(it.payout_amount ?? 0),
      zincPayout: Number(it.zinc_payout_amount ?? 0),
      isClaimable: it.is_claimable === true,
      solClaimed: it.sol_claimed === true,
    };
  });
}
