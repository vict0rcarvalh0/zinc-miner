import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { colors, spacing, font, glass, radius } from '../theme';
import { Card, SectionTitle, StatPill } from '../components/ui';
import { RoundTimer } from '../components/RoundTimer';
import { ResultsStrip } from '../components/ResultsStrip';
import { SolanaIcon } from '../components/icons/SolanaIcon';
import { ZincIcon } from '../components/icons/ZincIcon';
import { lamportsToSol, formatZinc } from '../lib/format';
import { opt } from '../solana/zincClient';
import { useRoundHistory } from '../hooks/useRoundHistory';
import type { ZincState } from '../hooks/useZincState';

export function HomeScreen({ state }: { state: ZincState }) {
  const { snapshot, profile, balanceLamports, session, slot } = state;

  const round = snapshot?.activeRound;
  const roundId = snapshot?.activeRoundId ?? null;
  const winningSquare = round ? opt<bigint>(round.winningSquare) : null;

  const claimableSol = profile ? Number(profile.claimableRoundSolLamports ?? 0n) : 0;
  const claimableZinc = profile ? (profile.claimableRoundZincRewards ?? 0n) : 0n;

  // Undistributed ZINC Bonanza jackpot.
  const bonanzaPot = snapshot?.bonanzaPot ?? null;

  // Round-history strip; the hook re-syncs on each round flip (with retries to
  // catch the just-ended round's delayed reveal).
  const { results } = useRoundHistory(roundId);

  // Reward "win" flash when claimable SOL jumps between polls.
  const [winFlash, setWinFlash] = useState<number | null>(null);
  const prevClaim = useRef<number | null>(null);
  useEffect(() => {
    if (prevClaim.current != null && claimableSol > prevClaim.current) {
      setWinFlash(claimableSol - prevClaim.current);
    }
    prevClaim.current = claimableSol;
  }, [claimableSol]);
  useEffect(() => {
    if (winFlash == null) return;
    const t = setTimeout(() => setWinFlash(null), 7000);
    return () => clearTimeout(t);
  }, [winFlash]);

  const closeAfter = round ? opt<bigint>(round.closeAfterSlot) : null;
  const startSlot = round ? opt<bigint>(round.startSlot) : null;
  const endSlot = round ? opt<bigint>(round.endSlot) : null;
  const targetSlot = closeAfter ?? endSlot;

  // Remember the last active round so the brief inter-round gap (activeRoundId
  // momentarily null) doesn't flash the "no live round" empty state.
  const lastRoundIdRef = useRef<bigint | null>(null);
  useEffect(() => {
    if (roundId != null) lastRoundIdRef.current = roundId;
  }, [roundId]);

  // When a round advances, briefly hold the previous round on screen so its
  // winning number can land where "pending" was before moving to the next.
  const [hold, setHold] = useState<bigint | null>(null);
  const prevRoundIdRef = useRef<bigint | null>(null);
  useEffect(() => {
    if (
      roundId != null &&
      prevRoundIdRef.current != null &&
      roundId !== prevRoundIdRef.current
    ) {
      setHold(prevRoundIdRef.current);
    }
    if (roundId != null) prevRoundIdRef.current = roundId;
  }, [roundId]);

  const winnerOf = useCallback(
    (id: bigint | null): number | null => {
      if (id == null) return null;
      if (roundId != null && id === roundId && winningSquare != null) {
        return Number(winningSquare) + 1;
      }
      const hit = results.find((r) => BigInt(r.id) === id);
      return hit ? hit.number : null;
    },
    [results, roundId, winningSquare],
  );

  // Release the hold once its result has shown briefly (or after a cap if the
  // reveal is slow to land).
  useEffect(() => {
    if (hold == null) return;
    const revealed = winnerOf(hold) != null;
    const t = setTimeout(() => setHold(null), revealed ? 5000 : 18000);
    return () => clearTimeout(t);
  }, [hold, winnerOf]);

  const displayId = hold ?? roundId ?? lastRoundIdRef.current;
  const displayWinner = winnerOf(displayId);
  const isLiveActive = hold == null && roundId != null;
  const showTimer = isLiveActive && winningSquare == null && targetSlot != null && slot != null;
  const statusLabel = displayWinner != null ? 'Result' : isLiveActive ? 'Open' : 'Settling';

  return (
    <View>
      {winFlash != null ? (
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.winBanner}>
          <View style={styles.winDot} />
          <Text style={styles.winText}>ROUND WON · REWARDS CREDITED</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.winAmt}>+{lamportsToSol(winFlash)}</Text>
          <SolanaIcon size={13} />
        </Animated.View>
      ) : null}

      <Card>
        <SectionTitle>Live Round</SectionTitle>
        {displayId != null ? (
          <>
            <View style={styles.roundHead}>
              <Text style={styles.roundId}>#{displayId.toString()}</Text>
              <View style={styles.statusChip}>
                <View
                  style={[
                    styles.live,
                    { backgroundColor: displayWinner != null ? colors.gold : colors.win },
                  ]}
                />
                <Text style={styles.statusText}>{statusLabel}</Text>
              </View>
            </View>

            {showTimer && targetSlot != null && slot != null ? (
              <RoundTimer
                slot={slot}
                startSlot={startSlot != null ? Number(startSlot) : null}
                targetSlot={Number(targetSlot)}
              />
            ) : null}

            {displayWinner != null ? (
              <Animated.View
                key={`${displayId.toString()}-${displayWinner}`}
                entering={ZoomIn.springify().damping(13)}
                style={styles.reveal}
              >
                <Text style={styles.revealCap}>RESULT</Text>
                <Text style={styles.revealNum}>{displayWinner}</Text>
              </Animated.View>
            ) : null}

            {isLiveActive && round ? (
              <View style={styles.pills}>
                <StatPill
                  label="Pot (deployed)"
                  value={lamportsToSol(round.totalDeployed)}
                  unit="sol"
                  accent={colors.accent}
                />
                <StatPill label="Miners" value={round.numberOfPlayers.toString()} />
                <StatPill
                  label="Winning number"
                  value={displayWinner != null ? `${displayWinner}` : 'pending'}
                  accent={displayWinner != null ? colors.gold : undefined}
                />
                <StatPill label="Winners" value={round.winners.toString()} />
              </View>
            ) : isLiveActive && !round ? (
              <Text style={styles.note}>
                Round is live, but this build of the Zinc SDK can't decode its
                details (pot, miners, winning number).
              </Text>
            ) : displayWinner == null ? (
              <Text style={styles.note}>
                Settling round — the winning number will appear here shortly…
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.empty}>
            No active round right now. The next round will appear here.
          </Text>
        )}
      </Card>

      {bonanzaPot != null ? (
        <Card>
          <SectionTitle>ZINC Bonanza</SectionTitle>
          <View style={styles.potRow}>
            <Text style={styles.potValue}>{formatZinc(bonanzaPot)}</Text>
            <ZincIcon size={24} color={colors.gold} />
          </View>
          <Text style={styles.potCap}>UNDISTRIBUTED JACKPOT</Text>
        </Card>
      ) : null}

      {results.length ? (
        <Card>
          <SectionTitle>Recent results</SectionTitle>
          <ResultsStrip results={results} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle>Your Wallet</SectionTitle>
        <View style={styles.pills}>
          <StatPill
            label="Balance"
            value={balanceLamports != null ? lamportsToSol(balanceLamports) : '—'}
            unit={balanceLamports != null ? 'sol' : undefined}
          />
          <StatPill
            label="Claimable SOL"
            value={lamportsToSol(claimableSol)}
            unit="sol"
            accent={claimableSol > 0 ? colors.win : undefined}
          />
          <StatPill
            label="Claimable ZINC"
            value={formatZinc(claimableZinc)}
            unit="zinc"
            accent={claimableZinc > 0n ? colors.gold : undefined}
          />
          <StatPill
            label="Auto-miner"
            value={session ? (session.paused ? 'Paused' : 'Active') : 'Off'}
            accent={session ? (session.paused ? colors.warn : colors.win) : undefined}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  winBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(63,185,80,0.12)',
    borderColor: colors.win,
    borderWidth: 1,
    borderRadius: radius.hud,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  winDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.win },
  winText: { color: colors.win, fontFamily: font.bold, fontSize: 12, letterSpacing: 0.8 },
  winAmt: { color: colors.text, fontFamily: font.bold, fontSize: 14 },
  roundHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  roundId: { color: colors.text, fontSize: 30, fontFamily: font.black },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: glass.fillStrong,
    borderColor: glass.borderDim,
    borderWidth: 1,
    borderRadius: radius.hud,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
  },
  live: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.win },
  statusText: { color: colors.textMuted, fontSize: 13, fontFamily: font.semibold },
  reveal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(249,115,21,0.12)',
    borderColor: colors.accent,
    borderWidth: 1.5,
    borderRadius: radius.hud,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  revealCap: { color: colors.accent, fontFamily: font.bold, fontSize: 11, letterSpacing: 2 },
  revealNum: { color: colors.text, fontFamily: font.black, fontSize: 28 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  empty: { color: colors.textFaint, fontSize: 14, lineHeight: 20 },
  note: { color: colors.warn, fontSize: 13, lineHeight: 19 },
  potRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  potValue: { color: colors.gold, fontFamily: font.black, fontSize: 36 },
  potCap: {
    color: colors.textFaint,
    fontFamily: font.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    marginTop: 2,
  },
});
