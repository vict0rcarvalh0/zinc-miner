# Zinc Miner — Seeker (Solana Mobile) App

A React Native (Expo) app for **Solana Seeker** that auto-mines [Zinc](https://zinc.cash)
directly from the on-device Seed Vault wallet over **Mobile Wallet Adapter**.

Zinc is an ORE-style game: each round you deploy SOL across tiles on a grid; a
hidden winning tile is revealed via Arcium MPC randomness and winners split the
pot and earn ZINC. This app drives Zinc's **on-chain auto-miner**: you pick a
tile pattern and parameters once, fund a budget, and Zinc's crank deploys for
you every round.

## What it does

The four parameters you asked for map 1:1 onto the on-chain `AutoMinerSession`:

| UI parameter        | On-chain field             | Meaning |
|---------------------|----------------------------|---------|
| **Amount**          | `amountPerRound`           | Gross lamports deployed each round |
| **Tiles**           | `maskBits*` (encrypted)    | Sealed tile pattern only the crank can read |
| **Rounds**          | `initialBudget` (= rounds × per-round cost) | Bounds how many rounds run |
| **Auto reload**     | `autoReloadSolRewards`     | Refill budget from credited SOL rewards |

Screens:
- **Mine** — live round (pot, miners, winning tile), wallet balance, claimables.
- **Auto-Miner** — the tile grid + parameters; `Start` / `Update` the session.
- **Session** — budget remaining, rounds mined, top-up, cancel & refund.

## Architecture

```
index.js              → installs polyfills, registers App
App.tsx               → providers + tab shell
src/
  config/zinc.ts       RPC, program/crank config, grid geometry  ← EDIT THIS
  polyfills.ts         Buffer / crypto / TextEncoder for Hermes
  wallet/              Mobile Wallet Adapter: authorize, cache, sign+send
  solana/
    connection.ts      shared RPC connection
    zincClient.ts      reads (board/round/config/session/profile) + ix builders
    mask.ts            x25519 + Arcium RescueCipher tile-pattern sealing
  hooks/               useZincState (polling), useAutoMiner (actions)
  components/, screens/  zinc.cash-style dark UI
```

All on-chain logic uses the **`@sphalerite-foundry/zinc-ts-sdk`** package in
`../zinc-ts-sdk` (v1.52.0 — the version whose board/round layout matches the
live mainnet game; npm's published 1.106.0 points at a frozen legacy board).
It provides the handwritten `buildInitAutoMinerSessionInstruction` / `Update` /
`TopUp` / `Cancel` builders and PDA/account fetchers; the app only assembles,
signs, and submits.

## How the tile pattern is encrypted (the tricky part)

The session stores your tiles **encrypted**, readable only by Zinc's crank.
`src/solana/mask.ts` reproduces the exact Arcium primitive the crank expects:

1. Pack selected tile indices into one little-endian bit field.
2. Generate an ephemeral **x25519** keypair (`@noble/curves`).
3. ECDH against the recipient x25519 key → shared secret.
4. Feed the secret to Arcium's **`RescueCipher`** (`@arcium-hq/client`), encrypt
   the bit field with a random 16-byte CTR nonce → one 32-byte limb.
5. Emit `{ maskBitsEncryptionKey, maskBitsNonce, maskBitsCiphertext,
   maskBitsKeyVersion }` for `initAutoMinerSession` / `updateAutoMinerSession`.

By default the recipient key is read live from the Arcium **MXE account** the
Zinc program is registered with (`getMXEAccAddress`) — the same key the crank
re-encrypts each per-round deploy to. You can pin it instead in config.

## Configure before running (`src/config/zinc.ts`)

Review/replace these before pointing at mainnet with real funds:

- **`RPC_ENDPOINT`** — use a paid RPC (Helius/Triton/QuickNode); the public
  endpoint throttles the status polling.
- **`ZINC_EXECUTOR`** — Zinc's published crank/executor wallet (defaults to the
  system program placeholder and **must** be set, or sessions are unusable).
- **`CRANK_X25519_PUBKEY`** — leave `null` to derive from the MXE account, or
  pin the crank's published x25519 key.
- **`CRANK_KEY_VERSION`** — must match the crank's current key generation.
- **`GRID_COLS` / `GRID_ROWS`** — board geometry (defaults to 5×5).

> The crank/executor address and key version are operational values published
> by Zinc; they are not in the SDK. Until `ZINC_EXECUTOR` is set the session
> instructions build but the crank cannot execute deploys.

## Build & run on a Seeker

Prerequisites: Node 18+, Android SDK + a Seeker (or Android device/emulator with
an MWA-compatible wallet such as the Seed Vault wallet or Phantom).

```bash
# 1) Build the local SDK once (the 1.52.0 in ../zinc-ts-sdk matches the live board)
cd zinc-ts-sdk && npm install && npm run build && cd ../app

# 2) Install + run the dev build on a connected device
npm install
npm run android      # = expo run:android (generates native android/ + installs)
```

Use `npm start` after the first native build for fast JS reloads. This app needs
a **dev build** (not Expo Go) because Mobile Wallet Adapter is a native module.

```bash
npm run typecheck    # type-check the app sources
```

## Notes & limitations

- The encrypted pattern can't be read back from chain, so **pause/resume/retile
  is done by re-submitting from the Auto-Miner tab**; the Session tab handles
  top-up and cancel (which don't touch the pattern).
- `@arcium-hq/client` is built for Node tooling; it runs here behind the Hermes
  polyfills in `src/polyfills.ts`. If a transitive Node API is missing at
  runtime, add the matching shim there.
- Targets mainnet-beta by default (`CLUSTER` / `MWA_CHAIN` in config).
```
