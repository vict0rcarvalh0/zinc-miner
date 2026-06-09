import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, font, radius, glass } from '../theme';
import { Card, SectionTitle } from '../components/ui';
import { useRoundHistory } from '../hooks/useRoundHistory';
import { computeRoundStats, type RoundResult } from '../lib/roundAnalytics';
import type { ZincState } from '../hooks/useZincState';

type WindowOpt = { label: string; n: number | null };
const WINDOWS: WindowOpt[] = [
  { label: '50', n: 50 },
  { label: '500', n: 500 },
  { label: 'All', n: null },
];

export function StatsScreen({ state }: { state: ZincState }) {
  const activeRoundId = state.snapshot?.activeRoundId ?? null;
  const { results, loading, error, refresh } = useRoundHistory(activeRoundId);

  const [win, setWin] = useState<number | null>(50);
  const [older, setOlder] = useState(false);

  // Slice the dataset (newest-first) by window + recent/older.
  const slice: RoundResult[] = useMemo(() => {
    if (win == null) return results;
    return older ? results.slice(-win) : results.slice(0, win);
  }, [results, win, older]);

  const stats = useMemo(() => computeRoundStats(slice), [slice]);
  const strip = slice.slice(0, 40);

  return (
    <View>
      <Card index={0}>
        <View style={styles.headRow}>
          <SectionTitle>Rounds reported</SectionTitle>
          <Pressable onPress={refresh} hitSlop={8}>
            <Text style={styles.sync}>{loading ? 'SYNCING…' : '↻ SYNC'}</Text>
          </Pressable>
        </View>

        <Text style={styles.bigCount}>{stats.count}</Text>

        <View style={styles.selectorRow}>
          {WINDOWS.map((w) => (
            <Selector
              key={w.label}
              label={w.label}
              active={win === w.n}
              onPress={() => setWin(w.n)}
            />
          ))}
          <View style={styles.spacer} />
          <Selector label="Recent" active={!older} onPress={() => setOlder(false)} />
          <Selector label="Older" active={older} onPress={() => setOlder(true)} />
        </View>

        {strip.length ? (
          <View style={styles.strip}>
            {strip.map((r, i) => (
              <View
                key={`${r.id}-${i}`}
                style={[styles.ball, r.number % 2 === 1 ? styles.ballOdd : styles.ballEven]}
              >
                <Text style={styles.ballText}>{r.number}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>
            {loading
              ? 'Indexing rounds from chain…'
              : error
                ? `Couldn't sync: ${error}`
                : 'No results yet. History fills in as rounds settle — keep the app open and pull to sync.'}
          </Text>
        )}
      </Card>

      <Card index={1}>
        <SectionTitle>Odd / Even</SectionTitle>
        <View style={styles.oeBar}>
          <View style={[styles.oeFill, styles.oeOdd, { flex: Math.max(stats.oddPct, 1) }]} />
          <View style={[styles.oeFill, styles.oeEven, { flex: Math.max(stats.evenPct, 1) }]} />
        </View>
        <View style={styles.oeLegend}>
          <Text style={styles.oeOddText}>
            ODD {stats.odd} / {stats.oddPct}%
          </Text>
          <Text style={styles.oeEvenText}>
            EVEN {stats.even} / {stats.evenPct}%
          </Text>
        </View>

        <View style={styles.runRow}>
          <Mini label="Run" value={runLabel(stats.currentRun)} />
          <Mini label="Longest" value={`${stats.longestOdd} odd / ${stats.longestEven} even`} />
        </View>
      </Card>

      <Card index={2}>
        <SectionTitle>Hot tiles</SectionTitle>
        <TileRow tiles={stats.hot} tone="hot" />
      </Card>

      <Card index={3}>
        <SectionTitle>Cold tiles</SectionTitle>
        <TileRow tiles={stats.cold} tone="cold" />
      </Card>
    </View>
  );
}

function runLabel(run: ReturnType<typeof computeRoundStats>['currentRun']): string {
  if (!run) return '—';
  return `${run.length} ${run.parity}`;
}

function Selector({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.sel, active && styles.selActive]}>
      <Text style={[styles.selText, active && styles.selTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <View style={styles.miniBar} />
      <View style={{ flex: 1 }}>
        <Text style={styles.miniLabel}>{label}</Text>
        <Text style={styles.miniValue}>{value}</Text>
      </View>
    </View>
  );
}

function TileRow({
  tiles,
  tone,
}: {
  tiles: { n: number; c: number }[];
  tone: 'hot' | 'cold';
}) {
  return (
    <View style={styles.tileRow}>
      {tiles.map((t) => (
        <View key={t.n} style={[styles.tile, tone === 'hot' ? styles.tileHot : styles.tileCold]}>
          <Text style={styles.tileNum}>#{t.n}</Text>
          <Text style={[styles.tileCount, tone === 'hot' ? styles.countHot : styles.countCold]}>
            {t.c}×
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sync: {
    color: colors.accent,
    fontFamily: font.bold,
    fontSize: 11,
    letterSpacing: 1.2,
  },
  bigCount: {
    color: colors.text,
    fontFamily: font.black,
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  spacer: { flex: 1, minWidth: spacing.sm },
  sel: {
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: radius.hud,
    borderWidth: 1,
    borderColor: glass.borderDim,
    backgroundColor: glass.fillStrong,
  },
  selActive: { borderColor: colors.accent, backgroundColor: 'rgba(249,115,21,0.16)' },
  selText: { color: colors.textMuted, fontFamily: font.bold, fontSize: 12, letterSpacing: 0.5 },
  selTextActive: { color: colors.accent },
  strip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ball: {
    width: 32,
    height: 32,
    borderRadius: radius.hud,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  ballOdd: { backgroundColor: 'rgba(249,115,21,0.16)', borderColor: 'rgba(249,115,21,0.4)' },
  ballEven: { backgroundColor: glass.fillStrong, borderColor: glass.borderDim },
  ballText: { color: colors.text, fontFamily: font.bold, fontSize: 13 },
  empty: { color: colors.textFaint, fontSize: 13, lineHeight: 19 },
  oeBar: {
    flexDirection: 'row',
    height: 14,
    borderRadius: radius.hud,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: glass.borderDim,
  },
  oeFill: { height: '100%' },
  oeOdd: { backgroundColor: colors.accent },
  oeEven: { backgroundColor: colors.surfaceAlt },
  oeLegend: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  oeOddText: { color: colors.accent, fontFamily: font.bold, fontSize: 13 },
  oeEvenText: { color: colors.textMuted, fontFamily: font.bold, fontSize: 13 },
  runRow: { flexDirection: 'row', gap: spacing.sm },
  mini: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: glass.fillStrong,
    borderColor: glass.borderDim,
    borderWidth: 1,
    borderRadius: radius.hud,
    overflow: 'hidden',
  },
  miniBar: { width: 2, backgroundColor: glass.border },
  miniLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: font.medium,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginLeft: spacing.md,
  },
  miniValue: {
    color: colors.text,
    fontSize: 15,
    fontFamily: font.bold,
    marginLeft: spacing.md,
    marginBottom: spacing.sm,
    marginTop: 2,
  },
  tileRow: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.hud,
    borderWidth: 1,
    backgroundColor: glass.fillStrong,
  },
  tileHot: { borderColor: 'rgba(249,115,21,0.45)' },
  tileCold: { borderColor: glass.borderDim },
  tileNum: { color: colors.text, fontFamily: font.black, fontSize: 15 },
  tileCount: { fontFamily: font.bold, fontSize: 12, marginTop: 2 },
  countHot: { color: colors.accent },
  countCold: { color: colors.textFaint },
});
