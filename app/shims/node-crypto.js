// Pure-JS stand-in for the small slice of Node's `crypto` module that
// `@arcium-hq/client` uses (and nothing else). Hermes has no Node crypto, so
// metro.config.js maps `crypto` -> this file.
//
// Arcium only needs:
//   - createHash('sha256') / createHash('sha3-256')  (key derivation, hashing)
//   - createCipheriv/createDecipheriv('aes-{128,192,256}-ctr')  (the cipher)
//   - randomBytes(n)
//
// Implemented with @noble/hashes + @noble/ciphers, which are audited pure-JS and
// follow the same standards (NIST SP800-38A AES-CTR), so ciphertext is
// byte-for-byte compatible with Node's crypto — i.e. the Zinc crank can still
// decrypt patterns we seal here.
const { Buffer } = require('buffer');
const { sha256 } = require('@noble/hashes/sha256');
const { sha3_256 } = require('@noble/hashes/sha3');
const { ctr } = require('@noble/ciphers/aes');

function toU8(data) {
  if (data == null) return new Uint8Array(0);
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return new Uint8Array(Buffer.from(data, 'utf8'));
  if (Array.isArray(data)) return Uint8Array.from(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return Uint8Array.from(data);
}

function concat(parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

const HASHERS = { sha256, 'sha3-256': sha3_256 };

function createHash(algorithm) {
  const fn = HASHERS[algorithm];
  if (!fn) {
    throw new Error(`node-crypto shim: unsupported hash "${algorithm}"`);
  }
  const parts = [];
  return {
    update(data) {
      parts.push(toU8(data));
      return this;
    },
    digest(encoding) {
      const out = Buffer.from(fn(concat(parts)));
      return encoding ? out.toString(encoding) : out;
    },
  };
}

// AES-CTR: encryption and decryption are the same keystream XOR, so one impl
// serves both createCipheriv and createDecipheriv. We buffer update() chunks and
// transform on final(); since CTR over a concatenation equals CTR over the
// chunks, `Buffer.concat([cipher.update(x), cipher.final()])` is correct.
function makeCtr(algorithm, key, iv) {
  if (!/^aes-(128|192|256)-ctr$/.test(algorithm)) {
    throw new Error(`node-crypto shim: unsupported cipher "${algorithm}"`);
  }
  const parts = [];
  return {
    update(data) {
      parts.push(toU8(data));
      return Buffer.alloc(0);
    },
    final() {
      return Buffer.from(ctr(toU8(key), toU8(iv)).encrypt(concat(parts)));
    },
    setAutoPadding() {
      return this; // no-op; CTR is unpadded
    },
  };
}

function createCipheriv(algorithm, key, iv) {
  return makeCtr(algorithm, key, iv);
}

function createDecipheriv(algorithm, key, iv) {
  return makeCtr(algorithm, key, iv);
}

const MAX_RANDOM_CHUNK = 65536; // getRandomValues per-call limit

function randomBytes(size) {
  const out = Buffer.alloc(size);
  for (let offset = 0; offset < size; offset += MAX_RANDOM_CHUNK) {
    const view = out.subarray(offset, Math.min(offset + MAX_RANDOM_CHUNK, size));
    globalThis.crypto.getRandomValues(view);
  }
  return out;
}

module.exports = {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
};
