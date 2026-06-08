import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, font, glass } from '../theme';
import { Sheen } from './fx/Sheen';
import { shortAddress } from '../lib/format';

export function Header({
  address,
  connecting,
  onConnect,
  onDisconnect,
}: {
  address: string | null;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <View style={styles.mark}>
          <Text style={styles.markText}>Zn</Text>
        </View>
        <Text style={styles.word}>ZINC</Text>
        <Text style={styles.tag}>MINER</Text>
      </View>

      {address ? (
        <Pressable style={styles.wallet} onPress={onDisconnect}>
          <View style={styles.dot} />
          <Text style={styles.walletText}>{shortAddress(address)}</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.wallet, styles.connect]}
          onPress={onConnect}
          disabled={connecting}
        >
          <View style={[styles.tick, styles.tickTL]} />
          <View style={[styles.tick, styles.tickBR]} />
          <Text style={styles.connectText}>
            {connecting ? 'Connecting…' : 'Connect'}
          </Text>
          {!connecting ? <Sheen period={2600} /> : null}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: {
    width: 34,
    height: 34,
    borderRadius: radius.hud,
    backgroundColor: colors.zinc,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: colors.onAccent, fontSize: 15, fontFamily: font.black },
  word: { color: colors.text, fontSize: 20, fontFamily: font.black, letterSpacing: 2 },
  tag: { color: colors.accent, fontSize: 12, fontFamily: font.bold, letterSpacing: 2, marginTop: 4 },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: glass.fillStrong,
    borderColor: glass.borderDim,
    borderWidth: 1,
    borderRadius: radius.hud,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  connect: {
    backgroundColor: 'rgba(249,115,21,0.14)',
    borderColor: colors.accent,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  connectText: {
    color: colors.accent,
    fontFamily: font.black,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  tick: { position: 'absolute', width: 7, height: 7, borderColor: colors.accent },
  tickTL: { top: 3, left: 3, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  tickBR: { bottom: 3, right: 3, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.win },
  walletText: { color: colors.text, fontFamily: font.mono, fontSize: 13 },
});
