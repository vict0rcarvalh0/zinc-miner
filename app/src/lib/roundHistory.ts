import { Buffer } from 'buffer';
import { Connection } from '@solana/web3.js';
import { getRoundAddress } from '@sphalerite-foundry/zinc-ts-sdk/codama-ts-custom';
import { getRoundDecoder } from '@sphalerite-foundry/zinc-ts-sdk/codama-ts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { opt } from '../solana/zincClient';
import { FIRST_NUMBER, LAST_NUMBER } from '../config/zinc';
import type { RoundResult } from './roundAnalytics';

const STORAGE_KEY = 'zinc.history.v1';
const MAX_STORED = 1000;

type HistoryMap = Map<number, number>; // roundId -> winning number (1..30)

/** Load the accumulated, persisted round results from disk. */
export async function loadHistory(): Promise<HistoryMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(obj).map(([k, v]) => [Number(k), v]));
  } catch {
    return new Map();
  }
}

async function saveHistory(map: HistoryMap): Promise<void> {
  // Keep only the most recent MAX_STORED ids so storage stays bounded.
  const entries = [...map.entries()].sort((a, b) => b[0] - a[0]).slice(0, MAX_STORED);
  const obj: Record<string, number> = {};
  for (const [id, n] of entries) obj[id] = n;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* best effort */
  }
}

function toResults(map: HistoryMap): RoundResult[] {
  return [...map.entries()]
    .map(([id, number]) => ({ id, number }))
    .sort((a, b) => b.id - a.id);
}

/**
 * Read the still-on-chain rounds in ONE batched `getMultipleAccountsInfo` call
 * (vs N getAccountInfo) — cheap and friendly to the rate-limited public RPC.
 * Decodes each existing account and keeps the settled ones (winningSquare set).
 */
async function fetchOnchainResults(
  conn: Connection,
  activeId: number,
  windowSize: number,
): Promise<RoundResult[]> {
  const ids: number[] = [];
  for (let i = 1; i <= windowSize; i++) {
    const id = activeId - i;
    if (id >= 1) ids.push(id);
  }
  const addrs = ids.map((id) => getRoundAddress(BigInt(id))[0]);
  const decoder = getRoundDecoder();
  const out: RoundResult[] = [];
  for (let i = 0; i < addrs.length; i += 100) {
    const infos = await conn.getMultipleAccountsInfo(addrs.slice(i, i + 100));
    infos.forEach((info, j) => {
      if (!info) return; // closed / never existed
      try {
        const r = decoder.decode(new Uint8Array(info.data));
        const ws = opt<bigint>(r.winningSquare);
        if (ws != null) out.push({ id: ids[i + j], number: Number(ws) + 1 });
      } catch {
        /* undecodable */
      }
    });
  }
  return out;
}

/**
 * Decode a Zinc `Program data:` event. The payload is a flat, self-describing
 * map: [u64 count] then `count` × ([u64 keyLen][key][u64 valLen][val]) with
 * ASCII string values. Returns a key→value map, or null if it doesn't parse.
 */
function parseEvent(b64: string): Record<string, string> | null {
  try {
    const buf = Buffer.from(b64, 'base64');
    let o = 0;
    const readLen = () => {
      // Lengths fit well within 32 bits; read low word, skip the high word.
      const n = buf[o] | (buf[o + 1] << 8) | (buf[o + 2] << 16) | (buf[o + 3] << 24);
      o += 8;
      return n >>> 0;
    };
    if (buf.length < 8) return null;
    const count = readLen();
    if (count <= 0 || count > 64) return null;
    const map: Record<string, string> = {};
    for (let i = 0; i < count; i++) {
      const kl = readLen();
      const key = buf.slice(o, o + kl).toString('utf8');
      o += kl;
      const vl = readLen();
      const val = buf.slice(o, o + vl).toString('utf8');
      o += vl;
      map[key] = val;
    }
    return map;
  } catch {
    return null;
  }
}

/** Extract a winning roulette number from a transaction's program logs. */
function winningFromLogs(logs: string[]): number | null {
  for (const line of logs) {
    const m = /^Program data: (.+)$/.exec(line);
    if (!m) continue;
    const ev = parseEvent(m[1]);
    if (!ev) continue;
    for (const [k, v] of Object.entries(ev)) {
      if (!/winning/i.test(k)) continue;
      const val = parseInt(v, 10);
      if (Number.isNaN(val)) continue;
      // `*_square` / `*_tile` are 0-based; `*_number` is already 1-based.
      const num = /number/i.test(k) ? val : val + 1;
      if (num >= FIRST_NUMBER && num <= LAST_NUMBER) return num;
    }
  }
  return null;
}

/**
 * Best-effort backfill of one older round's result by scanning its settlement
 * transactions. Bounded (few `getTransaction` calls) so it degrades gracefully
 * on a rate-limited public RPC; reaches deeper on a paid endpoint.
 */
async function backfillFromTx(
  conn: Connection,
  id: number,
  maxTx: number,
): Promise<number | null> {
  const pda = getRoundAddress(BigInt(id))[0];
  const sigs = await conn.getSignaturesForAddress(pda, { limit: 40 });
  let used = 0;
  for (const s of sigs) {
    if (s.err) continue;
    if (used >= maxTx) break;
    used += 1;
    const tx = await conn.getTransaction(s.signature, {
      maxSupportedTransactionVersion: 0,
    });
    const num = winningFromLogs(tx?.meta?.logMessages ?? []);
    if (num != null) return num;
  }
  return null;
}

export type SyncOptions = {
  /** How many rounds back we ultimately want to cover. */
  want: number;
  /** Allow the (rate-limit-heavy) transaction backfill for older rounds. */
  allowTx: boolean;
  /** Hard cap on getTransaction calls this sync, to stay under RPC limits. */
  txBudget?: number;
};

/**
 * Refresh the round-history cache: read the live on-chain window, optionally
 * backfill older rounds from transactions, persist, and return all known
 * results (most recent first). History accumulates across sessions, so the more
 * the app runs, the deeper the dataset becomes regardless of RPC limits.
 */
export async function syncRoundHistory(
  conn: Connection,
  activeId: number,
  options: SyncOptions,
): Promise<RoundResult[]> {
  const cache = await loadHistory();

  const recent = await fetchOnchainResults(conn, activeId, 12);
  for (const r of recent) cache.set(r.id, r.number);

  if (options.allowTx) {
    let budget = options.txBudget ?? 6;
    const floor = Math.max(1, activeId - options.want);
    for (let id = activeId - 1; id >= floor && budget > 0; id--) {
      if (cache.has(id)) continue;
      try {
        const perRound = Math.min(3, budget);
        const num = await backfillFromTx(conn, id, perRound);
        budget -= perRound;
        if (num != null) cache.set(id, num);
      } catch {
        budget -= 1; // count the failed attempt so we don't hammer the RPC
      }
    }
  }

  await saveHistory(cache);
  return toResults(cache);
}

/** Read-only: the cached history without any network calls (instant first paint). */
export async function cachedHistory(): Promise<RoundResult[]> {
  return toResults(await loadHistory());
}

export { LAST_NUMBER };
