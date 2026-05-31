// Visual language mirroring zinc.cash: a dark, industrial "smelter" palette
// with cool zinc-metal greys and an electric accent. Tuned for OLED Seeker.

export const colors = {
  // Backgrounds
  bg: '#0b0d10',
  bgElevated: '#11151a',
  surface: '#161b22',
  surfaceAlt: '#1c232c',
  border: '#262d38',
  borderBright: '#39434f',

  // Text
  text: '#e6edf3',
  textMuted: '#8b97a7',
  textFaint: '#5a6573',

  // Brand — zinc has a cool blue-silver sheen with an electric cyan accent
  zinc: '#9fb3c8',
  accent: '#3dd7d0',
  accentDim: '#1f8a86',
  accentGlow: 'rgba(61, 215, 208, 0.18)',

  // Semantic
  gold: '#f5b942', // ZINC token rewards
  win: '#3fb950',
  loss: '#f85149',
  warn: '#d29922',

  // Tile states
  tileIdle: '#1a212b',
  tileIdleBorder: '#2b3440',
  tileSelected: '#0e3f3d',
  tileSelectedBorder: '#3dd7d0',
  tileWinning: '#3a2e08',
  tileWinningBorder: '#f5b942',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const font = {
  // Use the platform monospace for the "machine readout" numerics, like zinc.cash
  mono: 'monospace',
} as const;
