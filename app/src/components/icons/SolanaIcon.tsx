import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

/**
 * The official Solana logomark (three slanted bars) — replaces the ◎ glyph that
 * rendered poorly in Oxanium. Defaults to the brand teal→purple gradient; pass
 * `color` for a monochrome version (e.g. to tint it the ZINC accent).
 */
export function SolanaIcon({ size = 14, color }: { size?: number; color?: string }) {
  const height = size * (311.7 / 397.7);
  const fill = color ?? 'url(#solGrad)';
  return (
    <Svg width={size} height={height} viewBox="0 0 397.7 311.7">
      {!color ? (
        <Defs>
          <LinearGradient id="solGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <Stop offset="0" stopColor="#9945FF" />
            <Stop offset="0.5" stopColor="#14B8F1" />
            <Stop offset="1" stopColor="#14F195" />
          </LinearGradient>
        </Defs>
      ) : null}
      <Path
        fill={fill}
        d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H15.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
      />
      <Path
        fill={fill}
        d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H15.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
      />
      <Path
        fill={fill}
        d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
      />
    </Svg>
  );
}
