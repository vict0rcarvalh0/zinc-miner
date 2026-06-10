// React Native / Hermes does not ship the Node + browser globals that
// @solana/web3.js, the Zinc SDK, and @arcium-hq/client expect. Install them
// here, and import this module first (see index.js).

// crypto.getRandomValues — required by web3.js Keypair, x25519, RescueCipher.
import 'react-native-get-random-values';

import { Buffer } from 'buffer';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { sha256 } from '@noble/hashes/sha256';
import { sha512, sha384 } from '@noble/hashes/sha512';

const globalAny = global as unknown as Record<string, unknown>;

if (typeof globalAny.Buffer === 'undefined') {
  globalAny.Buffer = Buffer;
}

if (typeof globalAny.TextEncoder === 'undefined') {
  globalAny.TextEncoder = TextEncoder;
}

if (typeof globalAny.TextDecoder === 'undefined') {
  globalAny.TextDecoder = TextDecoder;
}

// Some Solana deps reference `structuredClone`; Hermes lacks it.
if (typeof globalAny.structuredClone === 'undefined') {
  globalAny.structuredClone = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value)) as T;
}

// @solana/kit (used by the Zinc SDK for PDA derivation in instruction builders)
// calls `crypto.subtle.digest('SHA-256', …)` and refuses to run unless it sees a
// "secure context". React Native/Hermes provides neither, which surfaces as
// "Cryptographic operations are only allowed in secure browser contexts" when
// starting the auto-miner. Flag the context as secure and provide a minimal,
// audited SubtleCrypto `digest` backed by @noble/hashes (the only WebCrypto
// operation the SDK needs — PDA hashing).
if (typeof globalAny.isSecureContext === 'undefined') {
  globalAny.isSecureContext = true;
}

type DigestAlgo = string | { name: string };
const digestName = (a: DigestAlgo) => (typeof a === 'string' ? a : a.name).toUpperCase();

async function subtleDigest(
  algorithm: DigestAlgo,
  data: ArrayBuffer | ArrayBufferView,
): Promise<ArrayBuffer> {
  const bytes =
    data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  switch (digestName(algorithm)) {
    case 'SHA-256':
      return sha256(bytes).slice().buffer;
    case 'SHA-384':
      return sha384(bytes).slice().buffer;
    case 'SHA-512':
      return sha512(bytes).slice().buffer;
    default:
      throw new Error(`Unsupported digest algorithm: ${digestName(algorithm)}`);
  }
}

const cryptoObj = globalAny.crypto as
  | { subtle?: { digest?: unknown }; getRandomValues?: unknown }
  | undefined;
if (cryptoObj) {
  if (!cryptoObj.subtle) {
    try {
      (cryptoObj as Record<string, unknown>).subtle = { digest: subtleDigest };
    } catch {
      // `crypto` is non-extensible — swap in an extensible clone that preserves
      // the existing getRandomValues.
      globalAny.crypto = {
        getRandomValues: cryptoObj.getRandomValues,
        subtle: { digest: subtleDigest },
      };
    }
  } else if (typeof cryptoObj.subtle.digest !== 'function') {
    (cryptoObj.subtle as Record<string, unknown>).digest = subtleDigest;
  }
}
