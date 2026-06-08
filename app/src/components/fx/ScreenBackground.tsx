import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, hairline } from '../../theme';

const GRID = 34; // blueprint cell size in px

/**
 * Industrial / cyberpunk backdrop shared by every screen: a faint blueprint
 * grid, a slow-breathing orange glow bleeding from the top, a periodic scan
 * sweep that rakes down the display, and an edge vignette. All motion lives on
 * the Reanimated UI thread so it never competes with list/scroll work.
 */
export function ScreenBackground({ children }: { children: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  const sweep = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [sweep, breathe]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [-height * 0.25, height]) }],
    opacity: interpolate(sweep.value, [0, 0.12, 0.88, 1], [0, 1, 1, 0]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breathe.value, [0, 1], [0.22, 0.42]),
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.14]) }],
  }));

  // Static blueprint lines — rendered once, no per-frame cost.
  const grid = useMemo(() => {
    const rows = Math.ceil(height / GRID);
    const cols = Math.ceil(width / GRID);
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {Array.from({ length: rows }).map((_, i) => (
          <View key={`h${i}`} style={[styles.hLine, { top: i * GRID }]} />
        ))}
        {Array.from({ length: cols }).map((_, i) => (
          <View key={`v${i}`} style={[styles.vLine, { left: i * GRID }]} />
        ))}
      </View>
    );
  }, [width, height]);

  const glowSize = width * 1.5;

  return (
    <View style={styles.root}>
      {grid}

      {/* Orange glow bleeding from the top — faux-radial via stacked discs. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowWrap,
          { width: glowSize, height: glowSize, top: -glowSize * 0.62, left: (width - glowSize) / 2 },
          glowStyle,
        ]}
      >
        <View style={[styles.disc, { opacity: 0.06 }]} />
        <View style={[styles.disc, styles.disc2, { opacity: 0.09 }]} />
        <View style={[styles.disc, styles.disc3, { opacity: 0.14 }]} />
      </Animated.View>

      {/* Cyberpunk scan sweep. */}
      <Animated.View pointerEvents="none" style={[styles.sweep, sweepStyle]}>
        <LinearGradient
          colors={gradients.scanline}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Edge vignette to seat the content. */}
      <LinearGradient
        pointerEvents="none"
        colors={gradients.vignette}
        locations={[0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  content: { flex: 1 },
  hLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: hairline,
  },
  vLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: hairline,
  },
  glowWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  disc: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 9999,
    backgroundColor: colors.accent,
  },
  disc2: { width: '68%', height: '68%' },
  disc3: { width: '40%', height: '40%' },
  sweep: { position: 'absolute', left: 0, right: 0, height: 140 },
});
