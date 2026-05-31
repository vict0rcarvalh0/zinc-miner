import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, font } from '../theme';
import { GRID_COLS, TILE_COUNT } from '../config/zinc';

type MineGridProps = {
  selected: Set<number>;
  onToggle: (tile: number) => void;
  winningTile?: number | null;
  disabled?: boolean;
};

/**
 * The Zinc mining board: a square grid of tiles. Tapping a tile toggles it into
 * the auto-miner pattern. A revealed winning tile (post-settlement) is glowed.
 */
export function MineGrid({
  selected,
  onToggle,
  winningTile = null,
  disabled,
}: MineGridProps) {
  const tiles = Array.from({ length: TILE_COUNT }, (_, i) => i);
  return (
    <View style={styles.grid}>
      {tiles.map((tile) => {
        const isSelected = selected.has(tile);
        const isWinning = winningTile === tile;
        return (
          <Pressable
            key={tile}
            disabled={disabled}
            onPress={() => onToggle(tile)}
            style={[
              styles.tile,
              isSelected && styles.tileSelected,
              isWinning && styles.tileWinning,
            ]}
          >
            {isSelected && !isWinning ? (
              <View style={styles.pick} />
            ) : (
              <Text
                style={[
                  styles.tileLabel,
                  isWinning && { color: colors.gold },
                ]}
              >
                {isWinning ? '★' : tile + 1}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const GAP = 8;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'center',
  },
  tile: {
    // Five columns with gaps; width is a percentage so it scales to any device.
    width: `${100 / GRID_COLS - 2.4}%`,
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.tileIdle,
    borderWidth: 1.5,
    borderColor: colors.tileIdleBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileSelected: {
    backgroundColor: colors.tileSelected,
    borderColor: colors.tileSelectedBorder,
    shadowColor: colors.accent,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  tileWinning: {
    backgroundColor: colors.tileWinning,
    borderColor: colors.tileWinningBorder,
  },
  tileLabel: {
    color: colors.textFaint,
    fontSize: 13,
    fontFamily: font.mono,
  },
  pick: {
    width: '46%',
    height: '46%',
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
});
