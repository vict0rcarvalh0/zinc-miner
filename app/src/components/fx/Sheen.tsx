import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../../theme';

/**
 * A metallic light sweep that rakes diagonally across whatever it overlays —
 * the signature "machined surface catching the light" cue. Drop it as the last
 * child of a relatively-positioned, overflow-hidden container.
 */
export function Sheen({
  width = 90,
  period = 3200,
  delay = 0,
  angle = -18,
  style,
}: {
  /** Width of the moving highlight band, px. */
  width?: number;
  /** Full sweep cycle duration, ms. */
  period?: number;
  /** Initial delay so multiple sheens don't sync up, ms. */
  delay?: number;
  /** Tilt of the band, degrees. */
  angle?: number;
  style?: ViewStyle;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: period, easing: Easing.in(Easing.ease) }), -1, false),
    );
  }, [t, period, delay]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [-width * 1.5, 360]) },
      { rotateZ: `${angle}deg` },
    ],
    opacity: interpolate(t.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, style]}>
      <Animated.View style={[styles.band, { width }, animStyle]}>
        <LinearGradient
          colors={gradients.sheen}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  band: { position: 'absolute', top: -40, bottom: -40 },
});
