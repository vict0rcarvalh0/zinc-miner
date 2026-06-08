import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, font, radius, glass } from '../theme';
import {
  Card,
  SectionTitle,
  Label,
  NumberStepper,
  Toggle,
  PrimaryButton,
  StatPill,
} from '../components/ui';
import { RouletteBoard } from '../components/RouletteBoard';
import { lamportsToSol, solToLamports } from '../lib/format';
import {
  DEFAULT_CRANK_REIMBURSEMENT_LAMPORTS,
  LAMPORTS_PER_SOL,
  TILE_COUNT,
  tileToNumber,
} from '../config/zinc';
import { useAutoMiner } from '../hooks/useAutoMiner';
import type { ZincState } from '../hooks/useZincState';

// Outside-bet presets, expressed over displayed roulette numbers.
const ALL_TILES = Array.from({ length: TILE_COUNT }, (_, i) => i);
const EVEN_TILES = ALL_TILES.filter((t) => tileToNumber(t) % 2 === 0);
const ODD_TILES = ALL_TILES.filter((t) => tileToNumber(t) % 2 === 1);

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

  const setExactly = (tiles: number[]) => setSelected(new Set(tiles));
  const sameSet = (tiles: number[]) =>
    selected.size === tiles.length && tiles.every((t) => selected.has(t));

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
        <SectionTitle>Numbers</SectionTitle>
        <Text style={styles.help}>
          Pick the numbers the crank bets every round. Your selection is
          encrypted on-chain — only the crank can read it.
        </Text>

        <View style={styles.presets}>
          <PresetChip
            label="Odd"
            active={sameSet(ODD_TILES)}
            onPress={() => setExactly(ODD_TILES)}
          />
          <PresetChip
            label="Even"
            active={sameSet(EVEN_TILES)}
            onPress={() => setExactly(EVEN_TILES)}
          />
          <PresetChip
            label="All"
            active={sameSet(ALL_TILES)}
            onPress={() => setExactly(ALL_TILES)}
          />
          <PresetChip
            label="Clear"
            active={false}
            onPress={() => setExactly([])}
          />
        </View>

        <RouletteBoard selected={selected} onToggle={toggleTile} />
        <Text style={styles.selectedCount}>
          {selected.size} number{selected.size === 1 ? '' : 's'} selected
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

function PresetChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.textFaint, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  presets: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: radius.hud,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.fillStrong,
    borderWidth: 1,
    borderColor: glass.borderDim,
  },
  chipActive: { backgroundColor: 'rgba(249,115,21,0.16)', borderColor: colors.accent, borderWidth: 1.5 },
  chipText: { color: colors.textMuted, fontFamily: font.bold, fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' },
  chipTextActive: { color: colors.accent, fontFamily: font.black },
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
