import { PublicKey } from '@solana/web3.js';

/**
 * Network + protocol configuration.
 *
 * The Zinc program id is shipped by the SDK. Everything else here is
 * environment-specific and should be reviewed before pointing the app at
 * mainnet with real funds.
 */

// Zinc deploys to mainnet-beta. Use a paid RPC for production; the public
// endpoint is rate-limited and will throttle the auto-miner status polling.
export const CLUSTER = 'mainnet-beta' as const;

// Chain identifier passed to the Mobile Wallet Adapter `authorize` call.
// One of: 'solana:mainnet', 'solana:devnet', 'solana:testnet'.
export const MWA_CHAIN = 'solana:mainnet' as const;

// Override with your own RPC (Helius/Triton/QuickNode) for reliable polling.
export const RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com';

// Identity shown in the Seeker wallet's authorization sheet.
export const APP_IDENTITY = {
  name: 'Zinc Miner',
  uri: 'https://zinc.cash',
  icon: 'favicon.ico',
} as const;

// Grid geometry. Zinc, like ORE, plays on a square grid; the deploy mask packs
// the selected-tile bitset. Adjust if the live board geometry differs.
export const GRID_COLS = 5;
export const GRID_ROWS = 5;
export const TILE_COUNT = GRID_COLS * GRID_ROWS;

export const LAMPORTS_PER_SOL = 1_000_000_000;

/**
 * Crank / executor configuration for the on-chain auto-miner session.
 *
 * The session is created by the player but DEPLOYED each round by Zinc's crank
 * ("executor") wallet. The encrypted tile pattern is sealed to that crank's
 * x25519 key (see src/solana/mask.ts).
 *
 * Source these two values from Zinc's published crank parameters. By default
 * `CRANK_X25519_PUBKEY = null` makes mask.ts fall back to the on-chain Arcium
 * MXE x25519 key, which is the same key the crank re-encrypts deploys to.
 */
export const ZINC_EXECUTOR = new PublicKey(
  // TODO: replace with Zinc's published crank/executor wallet address.
  '11111111111111111111111111111111',
);

// Base58 x25519 public key the auto-miner pattern is encrypted to, or null to
// derive it from the on-chain MXE account at runtime.
export const CRANK_X25519_PUBKEY: string | null = null;

// Crank encryption-key version stored beside the sealed pattern. Must match the
// crank's current key generation.
export const CRANK_KEY_VERSION = 0;

// Fixed lamport reimbursement paid to the crank after each successful deploy.
export const DEFAULT_CRANK_REIMBURSEMENT_LAMPORTS = 25_000;
