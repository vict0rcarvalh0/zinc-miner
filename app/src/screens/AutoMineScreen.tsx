import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, font } from '../theme';
import {
  Card,
  SectionTitle,
  Label,
  NumberStepper,
  Toggle,
  PrimaryButton,
  StatPill,
} from '../components/ui';
import { MineGrid } from '../components/MineGrid';
import { lamportsToSol, solToLamports } from '../lib/format';
import {
  DEFAULT_CRANK_REIMBURSEMENT_LAMPORTS,
  LAMPORTS_PER_SOL,
} from '../config/zinc';
import { useAutoMiner } from '../hooks/useAutoMiner';
import { opt } from '../solana/zincClient';
import type { ZincState } from '../hooks/useZincState';

export function AutoMineScreen({
  state,
  connected,
}: {
  state: ZincState;
  connected: boolean;
}) {
  const { snapshot, session, balanceLamports, refresh } = state;
  const { start, update, busy, lastError } = useAutoMiner(refresh);

  const existing = session != null;

  // Defaults seeded from an existing session where the chain exposes the value.
  const [amountSol, setAmountSol] = useState(
    session ? Number(session.amountPerRound) / LAMPORTS_PER_SOL : 0.01,
  );
  const [rounds, setRounds] = useState(20);
  const [autoReload, setAutoReload] = useState(
    session?.autoReloadSolRewards ?? false,
  );
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggleTile = (tile: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tile)) next.delete(tile);
      else next.add(tile);
      return next;
    });

  const amountPerRound = solToLamports(amountSol);
  const reimbursement = BigInt(DEFAULT_CRANK_REIMBURSEMENT_LAMPORTS);
  const perRoundCost = amountPerRound + reimbursement;
  const initialBudget = perRoundCost * BigInt(rounds);

  const minDeploy = snapshot ? snapshot.config.minDeployLamports : 0n;
  const balance = balanceLamports != null ? BigInt(balanceLamports) : null;

  const validation = useMemo(() => {
    if (!connected) return 'Connect your Seeker wallet to continue.';
    if (selected.size === 0) return 'Tap at least one tile to mine.';
    if (amountPerRound < minDeploy)
      return `Amount per round must be ≥ ${lamportsToSol(minDeploy)} ◎.`;
    if (!existing && balance != null && initialBudget > balance)
      return 'Budget exceeds wallet balance.';
    return null;
  }, [connected, selected.size, amountPerRound, minDeploy, existing, balance, initialBudget]);

  const submit = async () => {
    const tiles = [...selected].sort((a, b) => a - b);
    const sig = existing
      ? await update({
          selectedTiles: tiles,
          amountPerRound,
          autoReloadSolRewards: autoReload,
          crankReimbursementLamports: reimbursement,
          paused: false,
        })
      : await start({
          selectedTiles: tiles,
          amountPerRound,
          initialBudget,
          autoReloadSolRewards: autoReload,
          crankReimbursementLamports: reimbursement,
        });
    if (sig) {
      Alert.alert(
        existing ? 'Auto-miner updated' : 'Auto-miner started',
        `Confirmed.\n\n${sig}`,
      );
    }
  };

  return (
    <View>
      <Card>
        <SectionTitle>Tile Pattern</SectionTitle>
        <Text style={styles.help}>
          Pick the tiles the crank deploys onto every round. Your pattern is
          encrypted on-chain — only the crank can read it.
        </Text>
        <MineGrid selected={selected} onToggle={toggleTile} />
        <Text style={styles.selectedCount}>
          {selected.size} tile{selected.size === 1 ? '' : 's'} selected
        </Text>
      </Card>

      <Card>
        <SectionTitle>Parameters</SectionTitle>

        <Label>Amount per round</Label>
        <NumberStepper
          value={amountSol}
          onChange={setAmountSol}
          step={0.01}
          min={0}
          suffix="◎"
          precision={3}
        />

        <View style={{ height: spacing.md }} />
        <Label>Rounds</Label>
        <NumberStepper
          value={rounds}
          onChange={(n) => setRounds(Math.round(n))}
          step={5}
          min={1}
          precision={0}
        />

        <View style={{ height: spacing.md }} />
        <Toggle
          label="Auto-reload from rewards"
          hint="Refill the budget from credited round SOL rewards"
          value={autoReload}
          onChange={setAutoReload}
        />
      </Card>

      <Card>
        <SectionTitle>Summary</SectionTitle>
        <View style={styles.pills}>
          <StatPill
            label="Per round"
            value={`${lamportsToSol(amountPerRound)} ◎`}
          />
          <StatPill label="Rounds" value={String(rounds)} />
          <StatPill
            label={existing ? 'New budget (top-up sep.)' : 'Budget required'}
            value={`${lamportsToSol(initialBudget)} ◎`}
            accent={colors.accent}
          />
          <StatPill
            label="Crank fee / round"
            value={`${lamportsToSol(reimbursement)} ◎`}
          />
        </View>
      </Card>

      {validation ? <Text style={styles.warn}>{validation}</Text> : null}
      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

      <PrimaryButton
        title={existing ? 'Update Auto-Miner' : 'Start Auto-Miner'}
        onPress={submit}
        busy={busy}
        disabled={validation != null}
      />
      <View style={{ height: spacing.xl }} />
    </View>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.textFaint, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  selectedCount: {
    color: colors.accent,
    fontFamily: font.mono,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warn: { color: colors.warn, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
  error: { color: colors.loss, fontSize: 13, marginBottom: spacing.md },
});
