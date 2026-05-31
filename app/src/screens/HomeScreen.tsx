import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, font } from '../theme';
import { Card, SectionTitle, StatPill } from '../components/ui';
import { lamportsToSol } from '../lib/format';
import { opt } from '../solana/zincClient';
import type { ZincState } from '../hooks/useZincState';

export function HomeScreen({ state }: { state: ZincState }) {
  const { snapshot, profile, balanceLamports, session } = state;

  const round = snapshot?.activeRound;
  const roundId = snapshot?.activeRoundId;
  const winningSquare = round ? opt<bigint>(round.winningSquare) : null;

  const claimableSol = profile
    ? Number(profile.claimableRoundSolLamports ?? 0n)
    : 0;
  const claimableZinc = profile
    ? Number(profile.claimableRoundZincRewards ?? 0n)
    : 0;

  return (
    <View>
      <Card>
        <SectionTitle>Live Round</SectionTitle>
        {round && roundId != null ? (
          <>
            <View style={styles.roundHead}>
              <Text style={styles.roundId}>#{roundId.toString()}</Text>
              <View style={styles.statusChip}>
                <View style={styles.live} />
                <Text style={styles.statusText}>
                  {winningSquare != null ? 'Revealed' : 'Open'}
                </Text>
              </View>
            </View>
            <View style={styles.pills}>
              <StatPill
                label="Pot (deployed)"
                value={`${lamportsToSol(round.totalDeployed)} ◎`}
                accent={colors.accent}
              />
              <StatPill
                label="Miners"
                value={round.numberOfPlayers.toString()}
              />
              <StatPill
                label="Winning tile"
                value={
                  winningSquare != null
                    ? `#${(winningSquare + 1n).toString()}`
                    : 'pending'
                }
                accent={winningSquare != null ? colors.gold : undefined}
              />
              <StatPill
                label="Winners"
                value={round.winners.toString()}
              />
            </View>
          </>
        ) : (
          <Text style={styles.empty}>
            No active round right now. The next round will appear here.
          </Text>
        )}
      </Card>

      <Card>
        <SectionTitle>Your Wallet</SectionTitle>
        <View style={styles.pills}>
          <StatPill
            label="Balance"
            value={
              balanceLamports != null
                ? `${lamportsToSol(balanceLamports)} ◎`
                : '—'
            }
          />
          <StatPill
            label="Claimable SOL"
            value={`${lamportsToSol(claimableSol)} ◎`}
            accent={claimableSol > 0 ? colors.win : undefined}
          />
          <StatPill
            label="Claimable ZINC"
            value={claimableZinc.toLocaleString()}
            accent={claimableZinc > 0 ? colors.gold : undefined}
          />
          <StatPill
            label="Auto-miner"
            value={session ? (session.paused ? 'Paused' : 'Active') : 'Off'}
            accent={
              session ? (session.paused ? colors.warn : colors.win) : undefined
            }
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  roundHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  roundId: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    fontFamily: font.mono,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.win },
  statusText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  empty: { color: colors.textFaint, fontSize: 14, lineHeight: 20 },
});
