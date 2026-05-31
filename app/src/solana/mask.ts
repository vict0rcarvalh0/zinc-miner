import { Connection, PublicKey } from '@solana/web3.js';
// Use Arcium's own x25519 so the ECDH exactly matches its RescueCipher.
// `getMXEAccAddress` derives the Arcium MXE account that publishes the cluster's
// x25519 public key the crank re-encrypts deploys to.
import { x25519, RescueCipher, getMXEAccAddress } from '@arcium-hq/client';
import { getMXEAccountDecoder } from '@sphalerite-foundry/zinc-ts-sdk/codama-ts';
import { CRANK_X25519_PUBKEY, CRANK_KEY_VERSION, TILE_COUNT } from '../config/zinc';

/**
 * Tile-pattern sealing for the on-chain auto-miner session.
 *
 * The session stores the player's chosen tile pattern ENCRYPTED so only the
 * Zinc crank can read it. Each round the crank decrypts the pattern and
 * re-encrypts a fresh mask to the Arcium MXE before calling
 * `deployRoundFromAutoSession`. We therefore seal the pattern with the exact
 * Arcium primitive the crank expects: an x25519 ECDH shared secret feeding a
 * Rescue (CTR-mode) cipher, producing a single 32-byte field-element limb.
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

const ARCIUM_ACCOUNT_DISCRIMINATOR_SIZE = 8;

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

/**
 * Resolves the x25519 public key the pattern must be sealed to. Prefers the
 * value pinned in config; otherwise reads the live Arcium MXE account that the
 * Zinc program is registered with.
 */
export async function resolveCrankEncryptionKey(
  connection: Connection,
  programId: PublicKey,
): Promise<Uint8Array> {
  if (CRANK_X25519_PUBKEY) {
    return base58ToBytes(CRANK_X25519_PUBKEY);
  }
  if (cachedCrankKey) {
    return cachedCrankKey;
  }

  const mxeAddress = getMXEAccAddress(programId);
  const info = await connection.getAccountInfo(mxeAddress);
  if (!info) {
    throw new Error(
      `Arcium MXE account not found at ${mxeAddress.toBase58()}. ` +
        'Set CRANK_X25519_PUBKEY in src/config/zinc.ts to the crank key.',
    );
  }
  const mxe = getMXEAccountDecoder().decode(
    info.data.slice(ARCIUM_ACCOUNT_DISCRIMINATOR_SIZE),
  );
  // utilityPubkeys is a Set/Unset union; both variants carry the UtilityPubkeys
  // struct (with x25519Pubkey) as the first tuple element.
  const utility = (
    mxe.utilityPubkeys as unknown as {
      fields: readonly [{ x25519Pubkey: Uint8Array }, ...unknown[]];
    }
  ).fields[0];
  cachedCrankKey = Uint8Array.from(utility.x25519Pubkey);
  return cachedCrankKey;
}

/** Seals a chosen tile pattern for the auto-miner session. */
export async function sealTilePattern(
  connection: Connection,
  programId: PublicKey,
  selectedTiles: readonly number[],
): Promise<SealedPattern> {
  if (selectedTiles.length === 0) {
    throw new Error('Select at least one tile before starting the auto-miner.');
  }

  const recipientKey = await resolveCrankEncryptionKey(connection, programId);

  // Ephemeral keypair — fresh per session update so patterns are unlinkable.
  // A raw 32-byte scalar works across @noble/curves versions (x25519 clamps it).
  const ephemeralPrivateKey = randomBytes(32);
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);
  const sharedSecret = x25519.getSharedSecret(ephemeralPrivateKey, recipientKey);

  const cipher = new RescueCipher(sharedSecret);
  const nonce = randomBytes(16);
  const patternBits = packTilePattern([...selectedTiles]);

  // Rescue encrypts an array of field elements; the pattern fits one limb.
  const limbs = cipher.encrypt([patternBits], nonce) as Array<
    Uint8Array | number[]
  >;
  const ciphertext = toFixedBytes(limbs[0], 32);

  return {
    maskBitsEncryptionKey: ephemeralPublicKey,
    maskBitsNonce: bytesToBigIntLE(nonce),
    maskBitsCiphertext: ciphertext,
    maskBitsKeyVersion: CRANK_KEY_VERSION,
  };
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

function base58ToBytes(value: string): Uint8Array {
  // Reuse web3.js' base58 implementation via PublicKey for a dependency-free decode.
  return new PublicKey(value).toBytes();
}
