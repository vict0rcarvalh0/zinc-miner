// React Native / Hermes does not ship the Node + browser globals that
// @solana/web3.js, the Zinc SDK, and @arcium-hq/client expect. Install them
// here, and import this module first (see index.js).

// crypto.getRandomValues — required by web3.js Keypair, x25519, RescueCipher.
import 'react-native-get-random-values';

import { Buffer } from 'buffer';
import { TextEncoder, TextDecoder } from 'text-encoding';

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
