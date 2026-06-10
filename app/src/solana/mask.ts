// Use Arcium's own x25519 so the ECDH exactly matches its RescueCipher.
import { x25519, RescueCipher } from '@arcium-hq/client';
import { Buffer } from 'buffer';
import {
  CRANK_X25519_PUBKEY,
  CRANK_KEY_VERSION,
  TILE_COUNT,
  ZINC_VALIDATE_PATTERN_URL,
} from '../config/zinc';

/**
 * Tile-pattern sealing for the on-chain auto-miner session.
 *
 * The session stores the player's chosen tile pattern ENCRYPTED so only Zinc's
 * crank can read it. We seal with the exact Arcium primitive the crank expects:
 * an x25519 ECDH shared secret feeding a Rescue (CTR-mode) cipher, producing a
 * single 32-byte field-element limb.
 *
 * The recipient is the **crank's auto-miner x25519 key** (NOT the Arcium MXE
 * key), published at `https://zinc.cash/api/app-config` as
 * `auto_miner_mask_bits_encryption_public_key` (base64) +
 * `auto_miner_mask_bits_key_version`. A seal produced this way is accepted by
 * Zinc's `POST /api/auto-miner/validate-pattern` endpoint (server decrypts OK),
 * which is what lets the crank actually deploy the pattern each round.
 *
 * Wire format produced here matches the `maskBits*` fields of
 * `initAutoMinerSession` / `updateAutoMinerSession`:
 *   - maskBitsEncryptionKey: 32-byte ephemeral x25519 public key
 *   - maskBitsNonce:         u128 (16-byte CTR nonce, little-endian)
 *   - maskBitsCiphertext:    32-byte sealed pattern limb
 *   - maskBitsKeyVersion:    crank key generation the pattern was sealed to
 */

export type SealedPattern = {
  maskBitsEncryptionKey: Uint8Array;
  maskBitsNonce: bigint;
  maskBitsCiphertext: Uint8Array;
  maskBitsKeyVersion: number;
};

const CIPHERTEXT_LIMB_BYTES = 32;
const NONCE_BYTES = 16;

let cachedCrankKey: Uint8Array | null = null;

/** Packs the selected tile indices into a single little-endian bit field. */
export function packTilePattern(selectedTiles: readonly number[]): bigint {
  let bits = 0n;
  for (const tile of selectedTiles) {
    if (tile < 0 || tile >= TILE_COUNT) {
      throw new Error(`Tile index ${tile} out of range 0..${TILE_COUNT - 1}`);
    }
    bits |= 1n << BigInt(tile);
  }
  return bits;
}

/** Decodes a packed bit field back into sorted tile indices (for previews). */
export function unpackTilePattern(bits: bigint): number[] {
  const tiles: number[] = [];
  for (let i = 0; i < TILE_COUNT; i++) {
    if ((bits >> BigInt(i)) & 1n) {
      tiles.push(i);
    }
  }
  return tiles;
}

/** The x25519 public key the auto-miner tile mask is sealed to (the crank key). */
function resolveCrankEncryptionKey(): Uint8Array {
  if (cachedCrankKey) {
    return cachedCrankKey;
  }
  const key = base64ToBytes(CRANK_X25519_PUBKEY);
  if (key.length !== CIPHERTEXT_LIMB_BYTES) {
    throw new Error(
      `CRANK_X25519_PUBKEY must decode to 32 bytes (got ${key.length}).`,
    );
  }
  cachedCrankKey = key;
  return key;
}

/** Seals a chosen tile pattern for the auto-miner session. */
export function sealTilePattern(selectedTiles: readonly number[]): SealedPattern {
  if (selectedTiles.length === 0) {
    throw new Error('Select at least one tile before starting the auto-miner.');
  }

  const recipientKey = resolveCrankEncryptionKey();

  // Ephemeral keypair — fresh per session update so patterns are unlinkable.
  // A raw 32-byte scalar works across @noble/curves versions (x25519 clamps it).
  const ephemeralPrivateKey = randomBytes(32);
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, recipientKey);

  const cipher = new RescueCipher(sharedSecret);
  const nonce = randomBytes(NONCE_BYTES);
  const patternBits = packTilePattern([...selectedTiles]);

  // Rescue encrypts an array of field elements; the pattern fits one limb.
  const limbs = cipher.encrypt([patternBits], nonce) as Array<
    Uint8Array | number[]
  >;
  const ciphertext = toFixedBytes(limbs[0], CIPHERTEXT_LIMB_BYTES);

  return {
    maskBitsEncryptionKey: ephemeralPublicKey,
    maskBitsNonce: bytesToBigIntLE(nonce),
    maskBitsCiphertext: ciphertext,
    maskBitsKeyVersion: CRANK_KEY_VERSION,
  };
}

/**
 * Pre-flight: ask Zinc whether the crank can actually decrypt this sealed
 * pattern. Returns `valid: false` only when the server is reachable AND rejects
 * it (a genuinely bad seal — e.g. a rotated crank key); network failures resolve
 * to `reachable: false` so we never block a session on a transient outage.
 */
export async function validateSealedPattern(
  sealed: SealedPattern,
): Promise<{ valid: boolean; reachable: boolean }> {
  try {
    const res = await fetch(ZINC_VALIDATE_PATTERN_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mask_bits_encryption_key: Buffer.from(sealed.maskBitsEncryptionKey).toString('base64'),
        mask_bits_nonce: sealed.maskBitsNonce.toString(),
        mask_bits_ciphertext: Buffer.from(sealed.maskBitsCiphertext).toString('base64'),
        mask_bits_key_version: sealed.maskBitsKeyVersion,
      }),
    });
    if (!res.ok) return { valid: false, reachable: true };
    const json = (await res.json()) as { valid?: boolean } | null;
    return { valid: json?.valid === true, reachable: true };
  } catch {
    return { valid: false, reachable: false };
  }
}

// ---- small byte helpers ------------------------------------------------------

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let value = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(bytes[i]);
  }
  return value;
}

function toFixedBytes(input: Uint8Array | number[], len: number): Uint8Array {
  const src = input instanceof Uint8Array ? input : Uint8Array.from(input);
  if (src.length === len) {
    return src;
  }
  const out = new Uint8Array(len);
  out.set(src.subarray(0, len));
  return out;
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}
