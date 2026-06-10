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
import { useRoundHistory } from '../hooks/useRoundHistory';
import { computeRoundStats } from '../lib/roundAnalytics';
import {
  coverage,
  estimateEv,
  backtest,
  riskLevel,
  suggestSizing,
  strategyTiles,
  type StrategyId,
} from '../lib/autoStrategy';
import type { ZincState } from '../hooks/useZincState';

const ALL_TILES = Array.from({ length: TILE_COUNT }, (_, i) => i);
const EVEN_TILES = ALL_TILES.filter((t) => tileToNumber(t) % 2 === 0);
const ODD_TILES = ALL_TILES.filter((t) => tileToNumber(t) % 2 === 1);
const RISK_PCTS = [25, 50, 75, 100];

// The tile mask is now sealed to the crank's auto-miner x25519 key and accepted
// by Zinc's /api/auto-miner/validate-pattern (server decrypts OK), so the crank
// can deploy. Flip to false again if sealing ever regresses.
const AUTO_DEPLOY_LIVE = true;

const solStr = (lamports: number | bigint) => lamportsToSol(Math.round(Number(lamports)));

export function AutoMineScreen({
  state,
  connected,
}: {
  state: ZincState;
  connected: boolean;
}) {
  const { snapshot, session, balanceLamports, refresh } = state;
  const { start, update, busy, lastError } = useAutoMiner(refresh);

  const { results } = useRoundHistory(snapshot?.activeRoundId ?? null);
  const stats = useMemo(() => computeRoundStats(results), [results]);

  const existing = session != null;

  const [amountSol, setAmountSol] = useState(
    session ? Number(session.amountPerRound) / LAMPORTS_PER_SOL : 0.05,
  );
  const [rounds, setRounds] = useState(20);
  const [autoReload, setAutoReload] = useState(session?.autoReloadSolRewards ?? false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Intelligence controls.
  const [stratCount, setStratCount] = useState(6);
  const [riskPct, setRiskPct] = useState(50);
  const [targetRounds, setTargetRounds] = useState(50);
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
  const applyStrategy = (id: StrategyId) =>
    setSelected(new Set(strategyTiles(id, stats, stratCount)));

  const reimbursement = BigInt(DEFAULT_CRANK_REIMBURSEMENT_LAMPORTS);
  const amountPerRound = solToLamports(amountSol);
  const perRoundCost = amountPerRound + reimbursement;
  const initialBudget = perRoundCost * BigInt(rounds);
  const minDeploy = snapshot ? snapshot.config.minDeployLamports : 0n;
  // The on-chain per-deploy minimum (0.05 SOL on mainnet); the control can't go below it.
  const minAmountSol = minDeploy > 0n ? Number(minDeploy) / LAMPORTS_PER_SOL : 0.05;
  const balance = balanceLamports != null ? BigInt(balanceLamports) : null;

  // Derived intelligence.
  const cov = useMemo(() => coverage(selected, results), [selected, results]);
  const round = snapshot?.activeRound ?? null;
  const pot = round ? round.totalDeployed : 0n;
  const ev = useMemo(
    () =>
      estimateEv({
        potLamports: pot,
        amountPerRound,
        selectedCount: selected.size,
        crankFee: reimbursement,
      }),
    [pot, amountPerRound, selected.size, reimbursement],
  );
  const bt = useMemo(
    () => backtest(selected, results, amountPerRound, reimbursement, ev.estPayoutIfHit),
    [selected, results, amountPerRound, reimbursement, ev.estPayoutIfHit],
  );
  const sizing = useMemo(
    () =>
      balance != null
        ? suggestSizing({
            balanceLamports: balance,
            riskPct,
            targetRounds,
            crankFee: reimbursement,
            minDeploy,
          })
        : null,
    [balance, riskPct, targetRounds, reimbursement, minDeploy],
  );
  const risk = riskLevel(initialBudget, balance);

  const applySizing = () => {
    if (!sizing) return;
    setAmountSol(Number(sizing.amountPerRound) / LAMPORTS_PER_SOL);
    setRounds(Math.max(1, targetRounds));
  };

  const validation = useMemo(() => {
    if (!connected) return 'Connect your Seeker wallet to continue.';
    if (selected.size === 0) return 'Tap at least one tile to mine.';
    if (amountPerRound < minDeploy)
      return `Amount per round must be ≥ ${lamportsToSol(minDeploy)} SOL.`;
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

  const riskColor =
    risk.level === 'high' ? colors.loss : risk.level === 'medium' ? colors.warn : colors.win;

  return (
    <View>
      <Card index={0}>
        <SectionTitle>Numbers</SectionTitle>
        <Text style={styles.help}>
          Pick the numbers the crank bets every round — or let a strategy pick.
          Your selection is encrypted on-chain.
        </Text>

        <View style={styles.presets}>
          <Chip label="Odd" active={sameSet(ODD_TILES)} onPress={() => setExactly(ODD_TILES)} />
          <Chip label="Even" active={sameSet(EVEN_TILES)} onPress={() => setExactly(EVEN_TILES)} />
          <Chip label="All" active={sameSet(ALL_TILES)} onPress={() => setExactly(ALL_TILES)} />
          <Chip label="Clear" active={false} onPress={() => setExactly([])} />
        </View>
        <View style={styles.presets}>
          <Chip label="Hot" active={false} onPress={() => applyStrategy('hot')} />
          <Chip label="Cold" active={false} onPress={() => applyStrategy('cold')} />
          <Chip label="Spread" active={false} onPress={() => applyStrategy('spread')} />
          <Chip label="Random" active={false} onPress={() => applyStrategy('random')} />
        </View>
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>Strategy size</Text>
          <View style={{ flex: 1 }} />
          <CompactStepper value={stratCount} onChange={setStratCount} min={1} max={TILE_COUNT} />
        </View>

        <RouletteBoard selected={selected} onToggle={toggleTile} />
        <Text style={styles.selectedCount}>
          {selected.size} number{selected.size === 1 ? '' : 's'} selected
        </Text>

        <View style={styles.covRow}>
          <Readout label="Coverage" value={`${cov.coveragePct}%`} />
          <Readout
            label="Hit rate"
            value={cov.n ? `${cov.hits}/${cov.n} · ${Math.round(cov.hitRate * 100)}%` : '—'}
            tint={colors.accent}
          />
          <Readout label="Expected" value={`${Math.round(cov.expectedRate * 100)}%`} />
        </View>
      </Card>

      <Card index={1}>
        <SectionTitle>Bankroll sizing</SectionTitle>
        <Text style={styles.help}>
          Spread a share of your wallet over a target run; we suggest the amount
          per round.
        </Text>
        <View style={styles.presets}>
          {RISK_PCTS.map((p) => (
            <Chip key={p} label={`${p}%`} active={riskPct === p} onPress={() => setRiskPct(p)} />
          ))}
        </View>
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>Target rounds</Text>
          <View style={{ flex: 1 }} />
          <CompactStepper value={targetRounds} onChange={setTargetRounds} min={1} max={5000} step={10} />
        </View>
        <View style={styles.pills}>
          <StatPill
            label="Suggested / round"
            value={sizing ? solStr(sizing.amountPerRound) : '—'}
            unit="sol"
            accent={colors.accent}
          />
          <StatPill label="Runway" value={sizing ? `${sizing.feasibleRounds} rounds` : '—'} />
          <StatPill label="Budget" value={sizing ? solStr(sizing.budget) : '—'} unit="sol" />
          <StatPill
            label="Wallet at risk"
            value={`${risk.pct.toFixed(0)}% · ${risk.level}`}
            accent={riskColor}
          />
        </View>
        <View style={{ height: spacing.md }} />
        <PrimaryButton title="Apply suggestion" tone="neutral" onPress={applySizing} />
      </Card>

      <Card index={2}>
        <SectionTitle>Parameters</SectionTitle>
        <Label>Amount per round</Label>
        <NumberStepper value={amountSol} onChange={setAmountSol} step={0.01} min={minAmountSol} unit="sol" precision={3} />
        <View style={{ height: spacing.md }} />
        <Label>Rounds</Label>
        <NumberStepper value={rounds} onChange={(n) => setRounds(Math.round(n))} step={1} min={1} precision={0} />
        <View style={{ height: spacing.md }} />
        <Toggle
          label="Auto-reload from rewards"
          hint="Refill the budget from credited round SOL rewards"
          value={autoReload}
          onChange={setAutoReload}
        />
      </Card>

      <Card index={3}>
        <SectionTitle>Payout estimate</SectionTitle>
        {round ? (
          <>
            <Text style={styles.help}>
              Rough estimate from the live pot ({solStr(pot)} SOL, assumed
              uniform). Each round is independent — this is guidance, not an edge.
            </Text>
            <View style={styles.pills}>
              <StatPill label="If a number hits" value={solStr(ev.estPayoutIfHit)} unit="sol" accent={colors.accent} />
              <StatPill label="Hit chance" value={`${Math.round(ev.hitProb * 100)}%`} />
              <StatPill label="Payout multiple" value={`${ev.payoutMultiple.toFixed(1)}x`} />
              <StatPill
                label="EV / round"
                value={solStr(ev.evPerRound)}
                unit="sol"
                accent={ev.evPerRound >= 0 ? colors.win : colors.loss}
              />
            </View>
          </>
        ) : (
          <Text style={styles.help}>Waiting on a live round to estimate payouts…</Text>
        )}
      </Card>

      <Card index={4}>
        <SectionTitle>Backtest</SectionTitle>
        {results.length ? (
          <>
            <Text style={styles.help}>
              Your numbers replayed over {bt.n} stored round{bt.n === 1 ? '' : 's'}. Net is an
              estimate (uses the live payout above).
            </Text>
            <View style={styles.pills}>
              <StatPill label="Hits" value={`${bt.hits} / ${bt.n}`} accent={colors.accent} />
              <StatPill label="Hit rate" value={`${Math.round(bt.hitRate * 100)}%`} />
              <StatPill
                label="Est. net"
                value={solStr(bt.netLamports)}
                unit="sol"
                accent={bt.netLamports >= 0 ? colors.win : colors.loss}
              />
            </View>
          </>
        ) : (
          <Text style={styles.help}>
            No history yet — open Trends to start accumulating round results.
          </Text>
        )}
      </Card>

      <Card index={5}>
        <SectionTitle>Summary</SectionTitle>
        <View style={styles.pills}>
          <StatPill label="Per round" value={lamportsToSol(amountPerRound)} unit="sol" />
          <StatPill label="Rounds" value={String(rounds)} />
          <StatPill
            label={existing ? 'New budget (top-up sep.)' : 'Budget required'}
            value={lamportsToSol(initialBudget)}
            unit="sol"
            accent={colors.accent}
          />
          <StatPill label="Crank fee / round" value={lamportsToSol(reimbursement)} unit="sol" />
        </View>
      </Card>

      {!AUTO_DEPLOY_LIVE ? (
        <View style={styles.guard}>
          <Text style={styles.guardTitle}>⚠ AUTO-DEPLOYS NOT LIVE YET</Text>
          <Text style={styles.guardBody}>
            The tile pattern is currently sealed with the wrong scheme, so Zinc's
            zk-mask-server can't read it and the crank won't mine this session.
            Starting will commit your budget on-chain (you'll have to Cancel &
            Refund it). Wiring the real mask sealing is in progress.
          </Text>
        </View>
      ) : null}

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

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function CompactStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <View style={styles.compact}>
      <Pressable style={styles.compactBtn} onPress={() => onChange(clamp(value - step))}>
        <Text style={styles.compactSign}>−</Text>
      </Pressable>
      <Text style={styles.compactValue}>{value}</Text>
      <Pressable style={styles.compactBtn} onPress={() => onChange(clamp(value + step))}>
        <Text style={styles.compactSign}>+</Text>
      </Pressable>
    </View>
  );
}

function Readout({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.readout}>
      <Text style={styles.readoutLabel}>{label}</Text>
      <Text style={[styles.readoutValue, tint ? { color: tint } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  help: { color: colors.textFaint, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  presets: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
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
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  countLabel: {
    color: colors.text,
    fontFamily: font.semibold,
    fontSize: 15,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: glass.fillStrong,
    borderColor: glass.borderDim,
    borderWidth: 1,
    borderRadius: radius.hud,
    overflow: 'hidden',
  },
  compactBtn: { width: 42, height: 40, alignItems: 'center', justifyContent: 'center' },
  compactSign: { color: colors.accent, fontSize: 22, fontFamily: font.bold },
  compactValue: {
    minWidth: 40,
    textAlign: 'center',
    color: colors.text,
    fontSize: 16,
    fontFamily: font.bold,
  },
  selectedCount: {
    color: colors.accent,
    fontFamily: font.mono,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  covRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  readout: {
    flex: 1,
    backgroundColor: glass.fillStrong,
    borderColor: glass.borderDim,
    borderWidth: 1,
    borderRadius: radius.hud,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  readoutLabel: {
    color: colors.textFaint,
    fontSize: 10,
    fontFamily: font.medium,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  readoutValue: { color: colors.text, fontFamily: font.bold, fontSize: 14 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  warn: { color: colors.warn, fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
  error: { color: colors.loss, fontSize: 13, marginBottom: spacing.md },
  guard: {
    backgroundColor: 'rgba(248,81,73,0.10)',
    borderColor: colors.loss,
    borderWidth: 1,
    borderRadius: radius.hud,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  guardTitle: {
    color: colors.loss,
    fontFamily: font.black,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  guardBody: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
});
