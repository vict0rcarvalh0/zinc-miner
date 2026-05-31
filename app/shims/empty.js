// Empty stub for Node core modules (`fs`, `path`) that the Zinc SDK references
// only inside its node-only circuit-publishing helpers. Those code paths are
// never reached by this app (we only build auto-miner session instructions and
// read accounts), but Metro still resolves their static top-level imports — so
// we point them here instead of failing the bundle.
module.exports = {};
