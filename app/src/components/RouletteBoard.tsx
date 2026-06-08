import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, font, spacing, glass } from '../theme';
import { GRID_COLS, TILE_COUNT, tileToNumber } from '../config/zinc';

type RouletteBoardProps = {
  /** Selected internal tile indices (0-based). */
  selected: Set<number>;
  onToggle: (tile: number) => void;
  /** Internal index of the revealed winning tile, if any. */
  winningTile?: number | null;
  disabled?: boolean;
};

/**
 * The ZINC roulette board: numbers 1..30 laid out as a felt betting grid. Tap a
 * number to drop a chip on it (spring bounce + pulsing orange glow); those tiles
 * become the auto-miner pattern. The revealed winning number spins a glowing
 * ring. All animation runs on the native driver (transform/opacity only), so it
 * stays smooth on the Seeker with no extra native deps.
 */
export function RouletteBoard({
  selected,
  onToggle,
  winningTile = null,
  disabled,
}: RouletteBoardProps) {
  const tiles = Array.from({ length: TILE_COUNT }, (_, i) => i);
  return (
    <View style={styles.grid}>
      {tiles.map((tile) => (
        <Tile
          key={tile}
          tile={tile}
          number={tileToNumber(tile)}
          picked={selected.has(tile)}
          winning={winningTile === tile}
          disabled={disabled}
          onPress={() => onToggle(tile)}
        />
      ))}
    </View>
  );
}

function Tile({
  tile,
  number,
  picked,
  winning,
  disabled,
  onPress,
}: {
  tile: number;
  number: number;
  picked: boolean;
  winning: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  // Two-tone felt for idle cells so the orange selection pops.
  const idleDark = number % 2 === 0;

  const press = useRef(new Animated.Value(0)).current; // 0 rest → 1 held
  const sel = useRef(new Animated.Value(picked ? 1 : 0)).current; // chip presence
  const bump = useRef(new Animated.Value(1)).current; // pop pulse on (de)select
  const glow = useRef(new Animated.Value(0)).current; // pulsing aura
  const spin = useRef(new Animated.Value(0)).current; // winning ring rotation
  const mounted = useRef(false);

  // Chip drop / lift whenever selection changes. A short index-based delay makes
  // bulk presets (Odd/Even/All) cascade across the board instead of snapping.
  useEffect(() => {
    Animated.sequence([
      Animated.delay(picked ? (tile % GRID_COLS) * 22 + Math.floor(tile / GRID_COLS) * 12 : 0),
      Animated.spring(sel, {
        toValue: picked ? 1 : 0,
        useNativeDriver: true,
        friction: 6,
        tension: 140,
      }),
    ]).start();

    // Skip the pop on first mount; only pulse on real user changes.
    if (mounted.current) {
      bump.setValue(picked ? 0.82 : 1.12);
      Animated.spring(bump, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
        tension: 200,
      }).start();
    } else {
      mounted.current = true;
    }
  }, [picked, tile, sel, bump]);

  // Breathing glow while a chip sits on the tile, or while it's the winner.
  useEffect(() => {
    if (picked || winning) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 950,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 950,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    glow.stopAnimation();
    glow.setValue(0);
    return undefined;
  }, [picked, winning, glow]);

  // Slow continuous spin on the winning ring.
  useEffect(() => {
    if (winning) {
      spin.setValue(0);
      const loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 4000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }
    return undefined;
  }, [winning, spin]);

  const cellScale = Animated.multiply(
    bump,
    press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }),
  );
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.6] });
  const glowScale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const chipTranslate = sel.interpolate({ inputRange: [0, 1], outputRange: [-13, 0] });
  const chipScale = sel.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.2, 0.9, 1] });
  const chipOpacity = sel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const active = picked || winning;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() =>
        Animated.spring(press, { toValue: 1, useNativeDriver: true, friction: 7, tension: 300 }).start()
      }
      onPressOut={() =>
        Animated.spring(press, { toValue: 0, useNativeDriver: true, friction: 7, tension: 300 }).start()
      }
      style={styles.cellWrap}
    >
      {/* Pulsing aura behind the cell */}
      {active ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.glow,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]}
        />
      ) : null}

      <Animated.View
        style={[
          styles.cell,
          idleDark ? styles.cellDark : styles.cellLight,
          picked && styles.cellPicked,
          winning && styles.cellWinning,
          { transform: [{ scale: cellScale }] },
        ]}
      >
        {/* Spinning ring on the winning number */}
        {winning ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { transform: [{ rotate: spinDeg }] }]}
          />
        ) : null}

        <Text style={[styles.num, active && styles.numActive]}>{number}</Text>

        {/* Poker chip that drops onto the tile when selected */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.chip,
            {
              opacity: chipOpacity,
              transform: [{ translateY: chipTranslate }, { scale: chipScale }],
            },
          ]}
        >
          <View style={styles.chipInner} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const GAP = 7;
const CELL_BASIS = `${100 / GRID_COLS - 2.6}%`;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'center',
  },
  cellWrap: {
    width: CELL_BASIS,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  cell: {
    width: '100%',
    height: '100%',
    borderRadius: radius.hud,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: glass.borderDim,
  },
  // Glassy HUD data-grid cells; a faint two-tone keeps the matrix legible.
  cellDark: { backgroundColor: glass.fill },
  cellLight: { backgroundColor: glass.fillStrong },
  cellPicked: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    backgroundColor: colors.tileSelected,
  },
  cellWinning: {
    borderColor: colors.tileWinningBorder,
    backgroundColor: colors.tileWinning,
  },
  ring: {
    position: 'absolute',
    width: '78%',
    height: '78%',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  num: {
    color: colors.textMuted,
    fontSize: 16,
    fontFamily: font.bold,
  },
  numActive: { color: colors.text },
  // Poker chip: orange disc with a dashed inset ring, parked at the cell's foot.
  chip: {
    position: 'absolute',
    bottom: spacing.xs,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.onAccent,
    borderStyle: 'dashed',
  },
});
