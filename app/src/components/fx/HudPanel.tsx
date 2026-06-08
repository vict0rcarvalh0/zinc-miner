import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, glass, radius, spacing } from '../../theme';

/**
 * The deeptech HUD surface: a frosted-glass panel (real blur on Android via the
 * dimezis method) tinted dark, framed by a thin neon-orange edge and reticle
 * corner brackets. Translucent on purpose so the animated grid/glow behind it
 * bleeds through — a holographic overlay rather than a solid card.
 */
export function HudPanel({
  children,
  style,
  padded = true,
  bracketColor = colors.accent,
  intensity = 16,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  bracketColor?: string;
  intensity?: number;
}) {
  return (
    <View style={[styles.panel, style]}>
      <BlurView
        intensity={intensity}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tint} />
      {/* Neon top edge */}
      <View style={styles.topEdge} />
      {/* Reticle corner brackets */}
      <View style={[styles.br, styles.tl, { borderColor: bracketColor }]} />
      <View style={[styles.br, styles.tr, { borderColor: bracketColor }]} />
      <View style={[styles.br, styles.bl, { borderColor: bracketColor }]} />
      <View style={[styles.br, styles.brr, { borderColor: bracketColor }]} />
      <View style={padded ? styles.body : undefined}>{children}</View>
    </View>
  );
}

const B = 12; // bracket arm length
const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.hud,
    borderWidth: 1,
    borderColor: glass.border,
    overflow: 'hidden',
    backgroundColor: glass.fill,
  },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: glass.tint },
  topEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: colors.accent,
    opacity: 0.85,
  },
  body: { padding: spacing.lg },
  br: { position: 'absolute', width: B, height: B },
  tl: { top: 5, left: 5, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  tr: { top: 5, right: 5, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  bl: { bottom: 5, left: 5, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  brr: { bottom: 5, right: 5, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
});
