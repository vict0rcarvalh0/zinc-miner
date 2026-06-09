import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInLeft, LinearTransition } from 'react-native-reanimated';
import { colors, glass, radius, font } from '../theme';
import type { RoundResult } from '../lib/roundAnalytics';

/**
 * Horizontal strip of the most recent winning numbers, newest first. When a
 * round resolves and a new result is prepended, its key is new so it springs in
 * from the left while the rest slide over — the "a round just ended" feedback.
 */
export function ResultsStrip({ results }: { results: RoundResult[] }) {
  const items = results.slice(0, 12);
  if (!items.length) return null;
  return (
    <View style={styles.strip}>
      {items.map((r, i) => (
        <Animated.View
          key={r.id}
          entering={FadeInLeft.springify().damping(15).mass(0.8)}
          layout={LinearTransition.springify().damping(18)}
          style={[
            styles.ball,
            r.number % 2 === 1 ? styles.odd : styles.even,
            i === 0 && styles.latest,
          ]}
        >
          <Text style={[styles.num, i === 0 && styles.numLatest]}>{r.number}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ball: {
    width: 30,
    height: 30,
    borderRadius: radius.hud,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  odd: { backgroundColor: 'rgba(249,115,21,0.14)', borderColor: 'rgba(249,115,21,0.35)' },
  even: { backgroundColor: glass.fillStrong, borderColor: glass.borderDim },
  latest: { borderColor: colors.accent, borderWidth: 1.5 },
  num: { color: colors.textMuted, fontFamily: font.bold, fontSize: 13 },
  numLatest: { color: colors.text },
});
