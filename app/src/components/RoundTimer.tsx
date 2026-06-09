import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, glass, radius, spacing, font } from '../theme';

const SLOT_MS = 400; // ~Solana slot time

/** Adaptive remaining-time label: d/h for long cycles, m:ss for short rounds. */
function formatRemaining(sec: number): string {
  if (sec >= 86400) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    return `${d}d ${h}h`;
  }
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Live round countdown + progress bar. The chain slot only refreshes on the
 * 15s poll, so we interpolate locally (slot drifts ~1 per 400ms) for a smooth
 * per-second tick between polls.
 */
export function RoundTimer({
  slot,
  startSlot,
  targetSlot,
}: {
  slot: number;
  startSlot: number | null;
  targetSlot: number;
}) {
  // Re-base the interpolation whenever a fresh slot lands.
  const baseSlot = useRef(slot);
  const baseAt = useRef(Date.now());
  useEffect(() => {
    baseSlot.current = slot;
    baseAt.current = Date.now();
  }, [slot]);

  // Tick once a second to recompute the estimate.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => (n + 1) % 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const estSlot = baseSlot.current + (Date.now() - baseAt.current) / SLOT_MS;
  const remainingSec = Math.max(0, ((targetSlot - estSlot) * SLOT_MS) / 1000);
  const total = startSlot != null ? Math.max(1, ((targetSlot - startSlot) * SLOT_MS) / 1000) : null;
  const pct = total ? Math.max(0, Math.min(1, (total - remainingSec) / total)) : 0;

  const w = useSharedValue(pct);
  useEffect(() => {
    w.value = withTiming(pct, { duration: 500 });
  }, [pct, w]);
  const barStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));

  const closing = remainingSec <= 0;
  const label = closing ? 'CLOSING…' : formatRemaining(remainingSec);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.cap}>{closing ? 'DEPOSITS' : 'ENDS IN'}</Text>
        <Text style={[styles.time, closing && { color: colors.warn }]}>{label}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, barStyle, closing && { backgroundColor: colors.warn }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cap: {
    color: colors.textFaint,
    fontFamily: font.medium,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  time: { color: colors.text, fontFamily: font.bold, fontSize: 16 },
  track: {
    height: 6,
    borderRadius: radius.hud,
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.borderDim,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.accent },
});
