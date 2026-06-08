// Visual language from the official ZINC identity guidelines (zinc.cash):
// pure-black OLED canvas, layered neutral greys, a single electric-orange
// accent, white / off-white text, and the Oxanium typeface. Tuned for Seeker.

export const colors = {
  // Backgrounds — ZINC: Black / Dark Gray / Gray
  bg: '#000000', // Black            #000000
  bgElevated: '#161616', // between black and Dark Gray, for inset wells
  surface: '#1F1F1F', // Dark Gray   #1F1F1F (cards)
  surfaceAlt: '#2A2A2A', // Gray      #2A2A2A (elevated / steppers)
  border: '#2A2A2A', // Gray, used as hairline borders on near-black
  borderBright: '#3A3A3A',

  // Text — ZINC: White / Off White
  text: '#FFFFFF', // White          #FFFFFF
  textMuted: '#ECEEF1', // Off White  #ECEEF1
  textFaint: '#8A8F98', // derived muted grey for hints/labels

  // Brand — single accent: ZINC Orange #F97315
  zinc: '#ECEEF1', // logo mark sits in off-white on black
  accent: '#F97315', // Orange        #F97315
  accentDim: '#7A3A0E', // dark orange for toggle tracks / pressed wells
  accentGlow: 'rgba(249, 115, 21, 0.18)',
  onAccent: '#000000', // text/icon on top of the orange accent

  // Semantic
  gold: '#F97315', // ZINC token rewards reuse the brand orange
  win: '#3FB950',
  loss: '#F85149',
  warn: '#F97315',

  // Tile states (roulette board)
  tileIdle: '#1F1F1F',
  tileIdleBorder: '#2A2A2A',
  tileSelected: '#3A1C06', // dark-orange wash
  tileSelectedBorder: '#F97315',
  tileWinning: '#3A1C06',
  tileWinningBorder: '#F97315',
} as const;

export const radius = {
  hud: 5, // sharp, machined corner for the deeptech HUD language
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

// Frosted-glass HUD surfaces: translucent so the animated grid/glow reads
// through them, framed by a thin neon-orange edge. The deeptech "holographic
// overlay" look, replacing the old solid brushed-metal panels.
export const glass = {
  fill: 'rgba(8,9,11,0.52)',
  fillStrong: 'rgba(10,11,14,0.74)',
  border: 'rgba(249,115,21,0.32)',
  borderDim: 'rgba(255,255,255,0.10)',
  tint: 'rgba(6,7,9,0.42)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// Oxanium is the ZINC brand typeface (loaded in App.tsx via expo-google-fonts).
// RN does not synthesize weights for custom fonts, so each weight is its own
// family and must be referenced explicitly rather than via fontWeight.
export const font = {
  regular: 'Oxanium_400Regular',
  medium: 'Oxanium_500Medium',
  semibold: 'Oxanium_600SemiBold',
  bold: 'Oxanium_700Bold',
  black: 'Oxanium_800ExtraBold',
  // Oxanium has tabular figures and a "machine readout" feel, so it doubles as
  // the numeric/mono face too — keeps balances and round numbers on-brand.
  mono: 'Oxanium_500Medium',
} as const;

// Gradients drive the "industrial / cyberpunk" depth: brushed-metal cards, a
// machined orange CTA, and metallic sheen sweeps. Consumed by expo-linear-gradient.
export const gradients = {
  metal: ['#2C2C2C', '#1C1C1C', '#121212'] as const, // brushed metal panel
  metalEdge: ['#3A3A3A', '#202020'] as const, // bevel / inset wells
  accent: ['#FFA052', '#F97315', '#C2530B'] as const, // machined orange button
  sheen: ['transparent', 'rgba(255,255,255,0.16)', 'transparent'] as const,
  accentHairline: ['transparent', '#F97315', 'transparent'] as const, // top-edge accent
  glow: ['rgba(249,115,21,0.0)', 'rgba(249,115,21,0.35)'] as const,
  vignette: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)'] as const,
  scanline: ['transparent', 'rgba(249,115,21,0.30)', 'transparent'] as const,
} as const;

// Shared motion language: a single confident spring + a few timing constants so
// every transition in the app feels like it comes from the same machine.
export const motion = {
  spring: { damping: 15, stiffness: 170, mass: 0.9 },
  springSoft: { damping: 20, stiffness: 110, mass: 1 },
  springSnappy: { damping: 12, stiffness: 260, mass: 0.7 },
  fast: 180,
  med: 320,
  slow: 640,
} as const;

// Hairline that reads as machined metal edge against the black canvas.
export const hairline = 'rgba(255,255,255,0.06)';
