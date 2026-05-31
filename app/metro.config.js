// Metro config tuned for the Solana web3.js / Zinc SDK toolchain. The Zinc SDK
// (installed from npm) ships an ESM/CJS `exports` map, so package-exports
// resolution must be enabled.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// The SDK and a few Solana deps publish a package `exports` field; Metro needs
// this enabled to resolve their subpath entry points (e.g. `/codama-ts-custom`).
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['react-native', 'browser', 'require', 'import'];

// Resolve native + CommonJS bundle variants shipped by Solana libraries.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'cjs', 'mjs'];

// The SDK bundle statically imports the Node core modules `fs` and `path` from
// its (dead, never-called) circuit-publishing helpers. RN has no such modules,
// so map them to an empty stub to keep the bundle resolvable. `buffer` resolves
// to the installed npm package and is left alone.
const emptyShim = path.resolve(projectRoot, 'shims/empty.js');
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  fs: emptyShim,
  path: emptyShim,
};

module.exports = config;
