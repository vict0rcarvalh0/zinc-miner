import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, glass, radius, font } from '../theme';
import {
  Card,
  SectionTitle,
  Label,
  StatPill,
  NumberStepper,
  PrimaryButton,
} from '../components/ui';
import { SolanaIcon } from '../components/icons/SolanaIcon';
import { ZincIcon } from '../components/icons/ZincIcon';
import { lamportsToSol, solToLamports, formatZinc } from '../lib/format';
import { useAutoMiner } from '../hooks/useAutoMiner';
import { usePlayerHistory } from '../hooks/usePlayerHistory';
import { opt, claimFeeLamports, claimFeeZinc } from '../solana/zincClient';
import { CLAIM_FEE_BPS, CLAIM_FEE_WALLET } from '../config/zinc';
import type { PlayerRound } from '../lib/playerHistory';
import type { ZincState } from '../hooks/useZincState';

export function SessionScreen({ state }: { state: ZincState }) {
  const { account, session, profile, refresh } = state;
  const { topUp, cancel, claimSol, claimAll, busy, lastError } = useAutoMiner(refresh);
  const [topUpSol, setTopUpSol] = useState(0.1);

  const pubkey = account?.toBase58() ?? null;
  const history = usePlayerHistory(pubkey);

  // Refresh the results list as the session mines more rounds.
  const roundsUsed = session ? session.roundsUsed.toString() : null;
  useEffect(() => {
    if (pubkey) history.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundsUsed]);

  const claimableSol = profile ? BigInt(profile.claimableRoundSolLamports ?? 0n) : 0n;
  // Unsmelted = freshly mined round ZINC; Smelted = refined ZINC earned from
  // other players' smelting (claim) fees.
  const unsmeltedZinc = profile ? BigInt(profile.claimableRoundZincRewards ?? 0n) : 0n;
  const smeltedZinc = profile ? BigInt(profile.refinedRoundZincRewards ?? 0n) : 0n;

  const feeEnabled = CLAIM_FEE_WALLET != null && CLAIM_FEE_BPS > 0;
  const feeSolOnClaim = claimFeeLamports(claimableSol);
  const feeZincOnClaim = claimFeeZinc(unsmeltedZinc);

  const onCancel = () =>
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

  const onTopUp = async () => {
    const sig = await topUp(solToLamports(topUpSol));
    if (sig) Alert.alert('Budget topped up', `Confirmed.\n\n${sig}`);
  };
  const onClaimSol = async () => {
    const sig = await claimSol(claimableSol);
    if (sig) {
      Alert.alert('SOL claimed', `Confirmed.\n\n${sig}`);
      refresh();
      history.refresh();
    }
  };
  const onClaimAll = async () => {
    const sig = await claimAll({
      sol: claimableSol > 0n,
      zinc: unsmeltedZinc > 0n,
      claimableSolLamports: claimableSol,
      claimableZinc: unsmeltedZinc,
    });
    if (sig) {
      Alert.alert('Rewards claimed', `Confirmed.\n\n${sig}`);
      refresh();
      history.refresh();
    }
  };

  if (!pubkey) {
    return (
      <Card>
        <SectionTitle>Session</SectionTitle>
        <Text style={styles.empty}>
          Connect your wallet to see your session, rewards, and round history.
        </Text>
      </Card>
    );
  }

  const expirySlot = session ? opt<bigint>(session.expirySlot) : null;

  return (
    <View>
      <Card index={0}>
        <SectionTitle>Rewards</SectionTitle>
        <View style={styles.pills}>
          <StatPill
            label="Claimable SOL"
            value={lamportsToSol(claimableSol)}
            unit="sol"
            accent={claimableSol > 0n ? colors.accent : undefined}
          />
          <StatPill
            label="Unsmelted ZINC"
            value={formatZinc(unsmeltedZinc, 6)}
            unit="zinc"
            accent={unsmeltedZinc > 0n ? colors.gold : undefined}
          />
          <StatPill
            label="Smelted ZINC"
            value={formatZinc(smeltedZinc, 6)}
            unit="zinc"
            accent={smeltedZinc > 0n ? colors.gold : undefined}
          />
        </View>
        <Text style={styles.note}>
          Unsmelted is freshly mined ZINC — claiming it smelts it to your wallet
          (a 10% fee refines into Smelted ZINC for holders). Smelted ZINC is yours
          from others' smelting fees.
        </Text>
        {feeEnabled ? (
          <Text style={styles.feeNote}>
            App fee: {CLAIM_FEE_BPS / 100}% on SOL + ZINC claims
            {feeSolOnClaim > 0n || feeZincOnClaim > 0n
              ? ` · ~${lamportsToSol(feeSolOnClaim)} SOL + ${formatZinc(feeZincOnClaim, 6)} ZINC on this claim`
              : ''}
            .
          </Text>
        ) : null}
        <View style={{ height: spacing.md }} />
        <View style={styles.claimRow}>
          <View style={styles.claimBtn}>
            <PrimaryButton
              title="Claim SOL"
              onPress={onClaimSol}
              busy={busy}
              disabled={claimableSol <= 0n}
            />
          </View>
          <View style={styles.claimBtn}>
            <PrimaryButton
              title="Claim All"
              tone="neutral"
              onPress={onClaimAll}
              disabled={claimableSol <= 0n && unsmeltedZinc <= 0n}
            />
          </View>
        </View>
      </Card>

      {session ? (
        <Card index={1}>
          <SectionTitle>Active Session</SectionTitle>
          <View style={styles.pills}>
            <StatPill
              label="Status"
              value={session.paused ? 'Paused' : 'Running'}
              accent={session.paused ? colors.warn : colors.win}
            />
            <StatPill
              label="Budget left"
              value={lamportsToSol(session.remainingBudget)}
              unit="sol"
              accent={colors.accent}
            />
            <StatPill
              label="Per round"
              value={lamportsToSol(session.amountPerRound)}
              unit="sol"
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
        </Card>
      ) : null}

      <Card index={2}>
        <View style={styles.headRow}>
          <SectionTitle>Round results</SectionTitle>
          <Pressable onPress={history.refresh} hitSlop={8}>
            <Text style={styles.sync}>{history.loading ? 'SYNCING…' : '↻'}</Text>
          </Pressable>
        </View>
        {history.rounds.length ? (
          <View>
            {history.rounds.slice(0, 25).map((r) => (
              <ResultRow key={r.roundId} r={r} />
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>
            {history.loading
              ? 'Loading your rounds…'
              : history.error
                ? `Couldn't load history: ${history.error}`
                : 'No rounds yet. They appear here as the crank deploys your tiles.'}
          </Text>
        )}
      </Card>

      {session ? (
        <Card index={3}>
          <SectionTitle>Top Up Budget</SectionTitle>
          <Label>Amount to add</Label>
          <NumberStepper
            value={topUpSol}
            onChange={setTopUpSol}
            step={0.05}
            min={0}
            unit="sol"
            precision={3}
          />
          <View style={{ height: spacing.md }} />
          <PrimaryButton
            title={`Add ${Number(topUpSol.toFixed(3))} SOL`}
            onPress={onTopUp}
            busy={busy}
            disabled={topUpSol <= 0}
          />
        </Card>
      ) : null}

      {lastError ? <Text style={styles.error}>{lastError}</Text> : null}

      {session ? (
        <PrimaryButton
          title="Cancel & Refund Session"
          onPress={onCancel}
          tone="danger"
          busy={busy}
        />
      ) : null}
      <View style={{ height: spacing.xl }} />
    </View>
  );
}

function ResultRow({ r }: { r: PlayerRound }) {
  const outcome = !r.isSettled ? 'pending' : r.isWinner ? 'won' : 'lost';
  const tone =
    outcome === 'won' ? colors.win : outcome === 'lost' ? colors.loss : colors.textFaint;
  const label = outcome === 'won' ? 'WON' : outcome === 'lost' ? 'LOST' : 'PENDING';
  return (
    <View style={styles.resultRow}>
      <Text style={styles.roundId}>#{r.roundId}</Text>
      <View style={[styles.badge, { borderColor: tone }]}>
        <Text style={[styles.badgeText, { color: tone }]}>{label}</Text>
      </View>
      {r.winningNumber != null ? (
        <Text style={styles.winNum}>· {r.winningNumber}</Text>
      ) : null}
      <View style={{ flex: 1 }} />
      {outcome === 'won' ? (
        <View style={styles.payCol}>
          <View style={styles.payRow}>
            <Text style={styles.payWin}>+{lamportsToSol(r.payoutLamports)}</Text>
            <SolanaIcon size={11} />
          </View>
          {r.zincPayout > 0 ? (
            <View style={styles.payRow}>
              <Text style={styles.payZinc}>+{formatZinc(r.zincPayout)}</Text>
              <ZincIcon size={11} />
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.dash}>{outcome === 'lost' ? `−${lamportsToSol(r.betLamports)}` : '—'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: colors.textFaint, fontSize: 14, lineHeight: 20 },
  note: { color: colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: spacing.md },
  feeNote: { color: colors.accent, fontSize: 12, fontFamily: font.semibold, marginTop: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  claimRow: { flexDirection: 'row', gap: spacing.sm },
  claimBtn: { flex: 1 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sync: { color: colors.accent, fontFamily: font.bold, fontSize: 13, letterSpacing: 0.5 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: glass.borderDim,
  },
  roundId: { color: colors.text, fontFamily: font.bold, fontSize: 14, minWidth: 56 },
  badge: {
    borderWidth: 1,
    borderRadius: radius.hud,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontFamily: font.black, fontSize: 10, letterSpacing: 1 },
  winNum: { color: colors.textFaint, fontFamily: font.mono, fontSize: 12 },
  payCol: { alignItems: 'flex-end' },
  payRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payWin: { color: colors.text, fontFamily: font.bold, fontSize: 13 },
  payZinc: { color: colors.text, fontFamily: font.bold, fontSize: 12 },
  dash: { color: colors.textFaint, fontFamily: font.mono, fontSize: 12 },
  error: { color: colors.loss, fontSize: 13, marginBottom: spacing.md },
});
