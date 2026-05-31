# Runbook — building & testing Zinc Miner on Seeker

A step-by-step guide to get the app running on a device and what to check at
each stage. Read top to bottom the first time.

---

## 0. Heads-up before you start (one required fix)

The mask encryption uses `@arcium-hq/client`, which imports Node's `crypto`.
Hermes (React Native's engine) has no `crypto`, so **the JS bundle will fail to
build until a crypto polyfill is wired in** (a small pure-JS shim mapped in
`metro.config.js`). This is tracked separately and is NOT yet applied.

- If it's been applied → follow the runbook as-is.
- If not → steps 1–4 work, but step 5 (`npm run android`) fails at the
  bundling stage with `Unable to resolve module crypto`. Ping me to land the
  shim first.

Everything else below is final and verified.

---

## 1. Prerequisites (host machine)

| Tool | Version | Check |
|------|---------|-------|
| Node | 18+ (20 LTS ideal) | `node -v` |
| Java JDK | 17 | `java -version` |
| Android SDK + platform-tools | latest | `adb version` |
| A device | **Seeker**, or any Android phone/emulator with an MWA wallet | `adb devices` |

Set `ANDROID_HOME` and put `platform-tools` on your `PATH` (so `adb` works).

**Wallet:** the app talks to an on-device wallet over Mobile Wallet Adapter.
On a Seeker that's the built-in Seed Vault wallet. On a normal Android device,
install **Phantom** or **Solflare** (they implement MWA). Expo Go will NOT work —
MWA is a native module, so you need the dev build produced below.

---

## 2. One-time: configure `app/src/config/zinc.ts`

Before mining for real, set:

- `RPC_ENDPOINT` → a paid mainnet RPC (public endpoint throttles polling).
- `ZINC_EXECUTOR` → Zinc's published crank wallet (placeholder by default;
  sessions are unusable until this is real).
- `CRANK_KEY_VERSION` → the crank's current key version.

> For a first **smoke test of the UI/wallet flow only**, you can leave these as
> defaults — the app launches, connects the wallet, and reads live round data.
> You just can't successfully *start* a session until `ZINC_EXECUTOR` is set.

There are no env vars and no `.env` file — this file is the only config surface.

---

## 3. Install app dependencies

```bash
cd app
npm install          # pulls @sphalerite-foundry/zinc-ts-sdk from npm
```

✅ Expect: install completes; `node_modules/` present.

---

## 4. Build & launch the dev build on the device

Connect/boot the device (`adb devices` shows it), then:

```bash
npm run android      # = expo run:android: generates native android/, builds, installs, launches
```

First run is slow (it compiles the native app). ✅ Expect: the app installs and
opens to the **Mine** tab.

For subsequent JS-only changes you don't need to rebuild native — just run the
Metro dev server and reload:

```bash
npm start            # dev server; press 'a' or shake device → Reload
```

---

## 5. Test checklist (what to verify, in order)

**A. App boots**
- Opens on the **Mine** tab with the ZINC header. No red error screen.

**B. Live data loads (no wallet needed)**
- "Live Round" card shows a round number, pot, miners. (Pull down to refresh.)
- If it stays empty, your `RPC_ENDPOINT` is likely rate-limited → use a paid RPC.

**C. Wallet connect (Mobile Wallet Adapter)**
- Tap **Connect** → the Seed Vault / Phantom sheet appears → approve.
- Header shows your shortened address; "Your Wallet" card shows your balance.
- Kill and reopen the app → it stays connected (auth token is cached).

**D. Auto-Miner config**
- Go to **Auto-Miner**. Tap tiles on the grid (they glow). Set amount, rounds,
  toggle auto-reload. The **Summary** card updates the budget live.
- Validation messages appear if not connected / no tiles / amount too low.

**E. Start a session** *(needs a real `ZINC_EXECUTOR`; use a tiny amount first)*
- Tap **Start Auto-Miner** → wallet approval sheet → approve.
- On success you get a confirmation alert with the tx signature.
- The **Session** tab now shows status, budget, rounds mined.
- Verify the signature on an explorer (e.g. solscan.io).

**F. Session management**
- **Session** tab: **Top Up** adds budget (approve in wallet); **Cancel &
  Refund** stops it and returns the remaining budget.

---

## 6. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `Unable to resolve module crypto` at bundle time | The crypto polyfill (section 0) isn't applied yet. |
| `Unable to resolve @sphalerite-foundry/zinc-ts-sdk/...` | `npm install` didn't complete — rerun section 3. |
| Live Round card never fills | RPC throttling — set a paid `RPC_ENDPOINT`. |
| Connect does nothing | No MWA wallet installed, or not on a real device/Seeker. |
| Session start fails / program error | `ZINC_EXECUTOR` / `CRANK_KEY_VERSION` not set correctly, or budget > balance. |
| `adb: no devices` | Device not connected/authorized, or emulator not booted. |

---

## 7. Quick command reference

```bash
# first time
cd app && npm install

# build + run on device
npm run android

# fast JS reload loop after the first native build
npm start

# type-check the app
npm run typecheck
```
