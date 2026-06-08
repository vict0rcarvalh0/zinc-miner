// Metro config tuned for the Solana web3.js / Zinc SDK toolchain. The Zinc SDK
// is consumed from the sibling `../zinc-ts-sdk` (built to dist/) via a `file:`
// dependency, and ships an ESM/CJS `exports` map.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const sdkRoot = path.resolve(projectRoot, '..', 'zinc-ts-sdk');
const config = getDefaultConfig(projectRoot);

// The SDK lives outside the app root; let Metro crawl it and fall back to the
// app's node_modules for the SDK's peer deps.
config.watchFolders = [sdkRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(sdkRoot, 'node_modules'),
];

// The SDK and a few Solana deps publish a package `exports` field; Metro needs
// this enabled to resolve their subpath entry points (e.g. `/codama-ts-custom`).
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require', 'import'];

// Resolve native + CommonJS bundle variants shipped by Solana libraries.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];

// The Mobile Wallet Adapter packages ship an `exports` map whose `browser`
// condition is listed BEFORE `react-native`. Package-exports resolution honors
// the package's key order, not our `unstable_conditionNames` order, so with
// package exports enabled Metro picks the `browser` build — whose `transact`
// throws "must be used in a secure context (https)" on a phone. Pin these two
// packages to their native entry so the local-association (native) transport is
// bundled instead. Surgical, so the rest of the Solana/Zinc tree is untouched.
const mwaNativeEntries = {
  '@solana-mobile/mobile-wallet-adapter-protocol': path.resolve(
    projectRoot,
    'node_modules/@solana-mobile/mobile-wallet-adapter-protocol/lib/cjs/index.native.js',
  ),
  '@solana-mobile/mobile-wallet-adapter-protocol-web3js': path.resolve(
    projectRoot,
    'node_modules/@solana-mobile/mobile-wallet-adapter-protocol-web3js/lib/cjs/index.native.js',
  ),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const nativeEntry = mwaNativeEntries[moduleName];
  if (nativeEntry && platform !== 'web') {
    return { type: 'sourceFile', filePath: nativeEntry };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// The SDK bundle statically imports the Node core modules `fs` and `path` from
// its (dead, never-called) circuit-publishing helpers. RN has no such modules,
// so map them to an empty stub to keep the bundle resolvable. `buffer` resolves
// to the installed npm package and is left alone.
const emptyShim = path.resolve(projectRoot, 'shims/empty.js');
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  fs: emptyShim,
  path: emptyShim,
  // @arcium-hq/client imports Node's `crypto`; Hermes has none. Route it to a
  // pure-JS shim covering the sha256/sha3-256 + aes-ctr + randomBytes it uses.
  crypto: path.resolve(projectRoot, 'shims/node-crypto.js'),
};

module.exports = config;
