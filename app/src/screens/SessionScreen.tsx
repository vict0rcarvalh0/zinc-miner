import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import {
  Card,
  SectionTitle,
  Label,
  StatPill,
  NumberStepper,
  PrimaryButton,
} from '../components/ui';
import { lamportsToSol, solToLamports } from '../lib/format';
import { useAutoMiner } from '../hooks/useAutoMiner';
import { opt } from '../solana/zincClient';
import type { ZincState } from '../hooks/useZincState';

export function SessionScreen({ state }: { state: ZincState }) {
  const { session, refresh } = state;
  const { topUp, cancel, busy, lastError } = useAutoMiner(refresh);
  const [topUpSol, setTopUpSol] = useState(0.1);

  if (!session) {
    return (
      <Card>
        <SectionTitle>Auto-Miner Session</SectionTitle>
        <Text style={styles.empty}>
          No active session. Head to the Auto-Miner tab to configure your tiles
          and start mining automatically.
        </Text>
      </Card>
    );
  }

  const expirySlot = opt<bigint>(session.expirySlot);

  const onCancel = () => {
    Alert.alert(
      'Cancel auto-miner?',
      'This stops automatic deploys and refunds the remaining budget to your wallet.',
      [
        { text: 'Keep mining', style: 'cancel' },
        {
          text: 'Cancel & refund',
          style: 'destructive',
          onPress: async () => {
            const sig = await cancel();
            if (sig) Alert.alert('Session cancelled', `Refunded.\n\n${sig}`);
          },
        },
      ],
    );
  };

  const onTopUp = async () => {
    const sig = await topUp(solToLamports(topUpSol));
    if (sig) Alert.alert('Budget topped up', `Confirmed.\n\n${sig}`);
  };

  return (
    <View>
      <Card>
        <SectionTitle>Active Session</SectionTitle>
        <View style={styles.pills}>
          <StatPill
            label="Status"
            value={session.paused ? 'Paused' : 'Running'}
            accent={session.paused ? colors.warn : colors.win}
          />
          <StatPill
            label="Budget left"
            value={`${lamportsToSol(session.remainingBudget)} ◎`}
            accent={colors.accent}
          />
          <StatPill
            label="Per round"
            value={`${lamportsToSol(session.amountPerRound)} ◎`}
          />
          <StatPill label="Rounds mined" value={session.roundsUsed.toString()} />
          <StatPill
            label="Auto-reload"
            value={session.autoReloadSolRewards ? 'On' : 'Off'}
            accent={session.autoReloadSolRewards ? colors.win : undefined}
          />
          <StatPill
            label="Expires at slot"
            value={expirySlot != null ? expirySlot.toString() : 'never'}
          />
        </View>
        <Text style={styles.note}>
          To change tiles, amount, pause, or resume, re-submit from the
          Auto-Miner tab (the encrypted pattern is rewritten on update).
        </Text>
      </Card>

      <Card>
        <SectionTitle>Top Up Budget</SectionTitle>
        <Label>Amount to add</Label>
        <NumberStepper
          value={topUpSol}
          onChange={setTopUpSol}
          step={0.05}
          min={0}
          suffix="◎"
          precision={3}
        />
        <View style={{ height: spacing.md }} />
        <PrimaryButton
          title={`Add ${Number(topUpSol.toFixed(3))} ◎`}
          onPress={onTopUp}
          busy={busy}
          disabled={topUpSol <= 0}
        />
      </Card>

      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

      <PrimaryButton
        title="Cancel & Refund Session"
        onPress={onCancel}
        tone="danger"
        busy={busy}
      />
      <View style={{ height: spacing.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textFaint, fontSize: 14, lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { color: colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  error: { color: colors.loss, fontSize: 13, marginBottom: spacing.md },
});
