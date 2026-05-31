import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, font } from '../theme';
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
          <Text style={styles.connectText}>
            {connecting ? 'Connecting…' : 'Connect'}
          </Text>
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
    borderRadius: radius.sm,
    backgroundColor: colors.zinc,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { color: '#0b0d10', fontWeight: '900', fontSize: 15, fontFamily: font.mono },
  word: { color: colors.text, fontSize: 20, fontWeight: '900', letterSpacing: 2 },
  tag: { color: colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginTop: 4 },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  connect: { backgroundColor: colors.accent, borderColor: colors.accent },
  connectText: { color: '#04110f', fontWeight: '800', fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.win },
  walletText: { color: colors.text, fontFamily: font.mono, fontSize: 13 },
});
